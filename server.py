"""Serve the prototype and store versioned usability sessions and attempts."""
import argparse
import hashlib
import json
import re
import sqlite3
from contextlib import closing
from datetime import date
from decimal import Decimal, InvalidOperation
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
STATIC = {'/', '/index.html', '/app.js', '/style.css', '/telemetry.js', '/booking-data.js',
          '/regions.js', '/entry-pages.js', '/booking-pages.js', '/patient-pages.js', '/startup.js', '/assets/doctors-grid.webp', '/assets/hospital-logo.webp'}
PAGES = set('cover home campus department doctors slots login method archive expired confirm success records guide settings'.split())
CONTROL = re.compile(r'[A-Za-z0-9:_-]{1,80}')
TEST_ID = re.compile(r'[A-Za-z0-9_-]{1,40}')
IDENTIFIER = re.compile(r'[a-f0-9]{36}')
PROFILE_KEYS = ('name', 'id', 'gender', 'birthday', 'height', 'weight', 'job', 'region', 'address')


def read_data(filename):
    return json.loads((ROOT / filename).read_text().split('=', 1)[1].rstrip(';\n'))


def require(condition):
    if not condition:
        raise ValueError('Invalid record')


def identifier(value):
    require(isinstance(value, str) and IDENTIFIER.fullmatch(value))
    return value


def conditions(value):
    require(isinstance(value, dict) and set(value) == {'expiry', 'delayed'})
    require(all(type(flag) is bool for flag in value.values()))
    return json.dumps(value, sort_keys=True)


def initialize_database(path, booking):
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path)) as db, db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS sessions (
              session TEXT PRIMARY KEY, participant_name TEXT NOT NULL, ip TEXT NOT NULL,
              started_ms INTEGER NOT NULL, started_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS events (
              session TEXT, seq INTEGER, client_ms INTEGER, kind TEXT, page TEXT, control TEXT,
              received_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(session,seq)
            );
            CREATE TABLE IF NOT EXISTS attempts (
              attempt TEXT PRIMARY KEY, session TEXT NOT NULL, started_ms INTEGER NOT NULL,
              conditions TEXT NOT NULL, started_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS session_returns (
              return_id TEXT PRIMARY KEY, session TEXT NOT NULL, attempt TEXT, page TEXT NOT NULL,
              client_ms INTEGER NOT NULL, ip TEXT NOT NULL, returned_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS doctors (
              id INTEGER PRIMARY KEY, name TEXT, department INTEGER, title TEXT, bio TEXT, portrait INTEGER
            );
        ''')
        db.execute('BEGIN IMMEDIATE')
        for table, additions in {
            'sessions': {'version': 'TEXT', 'conditions': 'TEXT', 'test_id': 'TEXT'},
            'events': {'attempt': 'TEXT', 'details': 'TEXT'},
        }.items():
            columns = {row[1] for row in db.execute(f'PRAGMA table_info({table})')}
            for name, sql_type in additions.items():
                if name not in columns:
                    db.execute(f'ALTER TABLE {table} ADD COLUMN {name} {sql_type}')
        old_columns = list(db.execute('PRAGMA table_info(submissions)'))
        legacy = old_columns and any(row[1] == 'session' and row[5] for row in old_columns)
        if legacy:
            db.execute('ALTER TABLE submissions RENAME TO submissions_legacy')
        db.execute('''CREATE TABLE IF NOT EXISTS submissions (
            attempt TEXT PRIMARY KEY, session TEXT NOT NULL, campus INTEGER, department INTEGER,
            day INTEGER, slot INTEGER, fields INTEGER, submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
            name TEXT, id_number TEXT, phone TEXT, verification_code TEXT, address TEXT, doctor INTEGER,
            clinic_type TEXT DEFAULT 'ordinary', fee_fen INTEGER DEFAULT 1530, snapshot TEXT
        )''')
        if legacy:
            # Preserve every old value, including original timestamps and nullable doctor IDs.
            names = [row[1] for row in old_columns]
            db.execute(f"INSERT INTO submissions(attempt,{','.join(names)}) "
                       f"SELECT 'legacy-'||session,{','.join(names)} FROM submissions_legacy")
            db.execute('DROP TABLE submissions_legacy')
        db.execute('CREATE INDEX IF NOT EXISTS submissions_session ON submissions(session)')
        for doctor in booking['doctors']:
            db.execute('INSERT OR REPLACE INTO doctors VALUES(?,?,?,?,?,?)',
                       tuple(doctor[k] for k in ('id', 'name', 'department', 'title', 'bio', 'portrait')))


def validate_submission(body, booking, regions):
    form = body['form']
    require(isinstance(form, list) and len(form) == 5 and all(type(v) is int for v in form))
    campus, department, day, slot, fields = form
    require(0 <= campus < len(booking['campuses']) and 0 <= department < len(booking['departments']))
    require(0 <= day < len(booking['dates']) and 0 <= slot < len(booking['dates'][day]['slots']))
    doctor = body['doctor']
    require(type(doctor) is int and 0 <= doctor < len(booking['doctors']))
    person = booking['doctors'][doctor]
    require(person['department'] == department and person['schedule'][day] == 'available')
    details = body['details']
    require(isinstance(details, list) and len(details) == 5 and all(isinstance(v, str) for v in details))
    name, identity, phone, code, address = details
    require(1 <= len(name.strip()) <= 20 and 1 <= len(address.strip()) <= 100)
    require(re.fullmatch(r'1[0-9]{10}', phone) and re.fullmatch(r'[0-9]{6}', code))
    require(re.fullmatch(r'[0-9]{17}[0-9Xx]', identity))
    weights = (7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2)
    require('10X98765432'[sum(int(v) * w for v, w in zip(identity[:17], weights)) % 11] == identity[-1].upper())
    birthday = date(int(identity[6:10]), int(identity[10:12]), int(identity[12:14]))
    require(birthday <= date.today())
    profile = body['profile']
    require(isinstance(profile, dict) and all(isinstance(profile.get(k), str) for k in PROFILE_KEYS))
    require(profile['name'] == name and profile['id'] == identity and profile['address'] == address)
    require(profile['birthday'] == birthday.isoformat() and profile['gender'] == ('男' if int(identity[16]) % 2 else '女'))
    for field, low, high in (('height', 30, 250), ('weight', 2, 350)):
        try:
            number = Decimal(profile[field])
            require(number.is_finite() and low <= number <= high and number * 10 % 1 == 0)
        except InvalidOperation:
            raise ValueError('Invalid measurement')
    require(profile['job'] in booking['jobs'] and profile['region'] in regions)
    require(fields == sum(1 << i for i, k in enumerate(PROFILE_KEYS) if profile[k].strip()) == 511)
    clinic_key = booking['dates'][day]['slots'][slot]['clinic']
    fee = booking['clinics'][clinic_key]['fee_fen']
    snapshot = json.dumps([form, details, doctor], ensure_ascii=False, separators=(',', ':'))
    return form, details, doctor, clinic_key, fee, hashlib.sha256(snapshot.encode()).hexdigest()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_request(self, code='-', size='-'):
        # Keep participant names out of HTTP access logs.
        self.log_message('"%s %s %s" %s %s', self.command, urlsplit(self.path).path,
                         self.request_version, str(code), str(size))

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

    def send_head(self):
        guides = self.server.booking['guideImages']
        guide_paths = {'/' + value for value in [guides['home'], *guides['campuses']]}
        if urlsplit(self.path).path not in STATIC | guide_paths:
            self.send_error(404)
            return None
        return super().send_head()

    def respond(self, status=204, body=None):
        self.send_response(status)
        if body is not None:
            encoded = json.dumps(body).encode()
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        if body is not None:
            self.wfile.write(encoded)

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            require(0 < length <= 65536)
            body = json.loads(self.rfile.read(length))
            require(isinstance(body, dict))
            session = identifier(body['session'])
            path = urlsplit(self.path).path
            result = None
            with closing(sqlite3.connect(self.server.database, timeout=10)) as db, db:
                if path == '/api/sessions':
                    name, timestamp = body['name'], body['started_ms']
                    require(isinstance(name, str) and 1 <= len(name.strip()) <= 40 and type(timestamp) is int and timestamp > 0)
                    require(body['version'] == self.server.booking['version'])
                    flags = conditions(body['conditions'])
                    test_id = body.get('test_id')
                    if test_id is not None:
                        require(isinstance(test_id, str) and TEST_ID.fullmatch(test_id))
                        require(not re.search(r'[\x00-\x1f\x7f]', name))
                    db.execute('INSERT OR IGNORE INTO sessions(session,participant_name,ip,started_ms,version,conditions,test_id) VALUES(?,?,?,?,?,?,?)',
                               (session, name.strip(), self.client_address[0], timestamp, body['version'], flags, test_id))
                    if test_id is not None:
                        row = db.execute('SELECT test_id,participant_name FROM sessions WHERE session=?', (session,)).fetchone()
                        require(row == (test_id, name.strip()))
                else:
                    require(db.execute('SELECT 1 FROM sessions WHERE session=?', (session,)).fetchone())
                    if path == '/api/resume':
                        require(body['version'] == self.server.booking['version'])
                        saved_version, test_id, name = db.execute(
                            'SELECT version,test_id,participant_name FROM sessions WHERE session=?', (session,)).fetchone()
                        require(saved_version == body['version'])
                        if 'test_id' in body or 'name' in body:
                            require(test_id is not None and body.get('test_id') == test_id and body.get('name') == name)
                        attempt = body['attempt']
                        if attempt is not None:
                            identifier(attempt)
                            require(db.execute('SELECT 1 FROM attempts WHERE attempt=? AND session=?', (attempt, session)).fetchone())
                        return_id = identifier(body['return_id'])
                        require(body['page'] in PAGES and body['page'] != 'cover')
                        require(type(body['client_ms']) is int and body['client_ms'] > 0)
                        db.execute('INSERT OR IGNORE INTO session_returns(return_id,session,attempt,page,client_ms,ip) VALUES(?,?,?,?,?,?)',
                                   (return_id, session, attempt, body['page'], body['client_ms'], self.client_address[0]))
                        require(db.execute('SELECT session FROM session_returns WHERE return_id=?', (return_id,)).fetchone()[0] == session)
                        result = {'last_seq': db.execute('SELECT COALESCE(MAX(seq),0) FROM events WHERE session=?', (session,)).fetchone()[0]}
                    elif path == '/api/attempts':
                        attempt = identifier(body['attempt'])
                        require(type(body['started_ms']) is int and body['started_ms'] > 0)
                        db.execute('INSERT OR IGNORE INTO attempts(attempt,session,started_ms,conditions) VALUES(?,?,?,?)',
                                   (attempt, session, body['started_ms'], conditions(body['conditions'])))
                        require(db.execute('SELECT session FROM attempts WHERE attempt=?', (attempt,)).fetchone()[0] == session)
                    elif path == '/api/events':
                        result = self.save_events(db, session, body['events'])
                    elif path == '/api/submissions':
                        attempt = identifier(body['attempt'])
                        require(db.execute('SELECT 1 FROM attempts WHERE attempt=? AND session=?', (attempt, session)).fetchone())
                        form, details, doctor, clinic, fee, snapshot = validate_submission(body, self.server.booking, self.server.regions)
                        previous = db.execute('SELECT snapshot FROM submissions WHERE attempt=?', (attempt,)).fetchone()
                        if previous and previous[0] != snapshot:
                            self.respond(409, {'error': 'attempt_already_submitted'})
                            return
                        db.execute('''INSERT OR IGNORE INTO submissions
                            (attempt,session,campus,department,day,slot,fields,name,id_number,phone,verification_code,address,doctor,clinic_type,fee_fen,snapshot)
                            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                            (attempt, session, *form, *details, doctor, clinic, fee, snapshot))
                    else:
                        self.respond(404)
                        return
            self.respond(200 if result is not None else 204, result)
        except (ValueError, KeyError, TypeError, OverflowError):
            self.respond(400, {'error': 'invalid_record'})
        except sqlite3.Error:
            self.respond(503, {'error': 'storage_unavailable'})

    def save_events(self, db, session, events):
        require(isinstance(events, list) and 1 <= len(events) <= 100)
        accepted, rejected = [], []
        for index, event in enumerate(events):
            try:
                if isinstance(event, list):
                    require(len(event) == 5)
                    event = dict(zip(('seq', 'client_ms', 'kind', 'page', 'control'), event))
                require(isinstance(event, dict))
                seq, timestamp = event['seq'], event['client_ms']
                kind, page, control = event['kind'], event['page'], event['control']
                require(type(seq) is int and seq > 0 and type(timestamp) is int and timestamp > 0)
                require(kind in ('click', 'view', 'invalid', 'submit', 'result', 'dialog') and page in PAGES)
                require(isinstance(control, str) and CONTROL.fullmatch(control))
                attempt = event.get('attempt')
                if attempt is not None:
                    identifier(attempt)
                    require(db.execute('SELECT 1 FROM attempts WHERE attempt=? AND session=?', (attempt, session)).fetchone())
                details = event.get('details', {})
                require(isinstance(details, dict) and len(details) <= 12)
                require(all(isinstance(k, str) and len(k) <= 40 and isinstance(v, (str, int, bool)) and len(str(v)) <= 200 for k, v in details.items()))
                db.execute('INSERT OR IGNORE INTO events(session,seq,client_ms,kind,page,control,attempt,details) VALUES(?,?,?,?,?,?,?,?)',
                           (session, seq, timestamp, kind, page, control, attempt, json.dumps(details)))
                accepted.append(index)
            except (ValueError, KeyError, TypeError):
                rejected.append({'index': index, 'reason': 'invalid_event'})
        return {'accepted': accepted, 'rejected': rejected}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8767)
    parser.add_argument('--bind', default='0.0.0.0')
    parser.add_argument('--database', type=Path, default=ROOT / 'data' / 'study.sqlite3')
    args = parser.parse_args()
    booking = read_data('booking-data.js')
    regions = {province + city + district for province, cities in read_data('regions.js').items()
               for city, districts in cities.items() for district in districts}
    initialize_database(args.database, booking)
    with ThreadingHTTPServer((args.bind, args.port), Handler) as server:
        server.database, server.booking, server.regions = args.database, booking, regions
        print(f'Listening on {args.bind}:{args.port}', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
