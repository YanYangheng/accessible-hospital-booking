"""Serve the local prototype and store anonymous usability records."""
import argparse
import json
import re
import sqlite3
from contextlib import closing
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
STATIC = {'/', '/index.html', '/app.js', '/style.css', '/telemetry.js', '/doctors.js', '/assets/doctors-grid.png', '/assets/hospital-logo.webp'}
PAGES = set('home campus department doctors slots login method archive expired confirm success records guide settings'.split())
CONTROL = re.compile(r'(?:home|start|back|doctor-next|change-doctor|mode:doctor|mode:date|send|archive|guide|records|recover|submit|apply|settings|method|sample|background|phone|code|search|expiry|delayed|archive-submit|login-submit|field-(?:name|id|gender|birthday|height|weight|job|region|address)|(?:campus|department|doctor|date|slot):[0-9]{1,2})')
UUID = re.compile(r'[a-f0-9-]{36}')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        if urlsplit(self.path).path not in STATIC:
            self.send_error(404)
            return None
        return super().send_head()

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length <= 65536:
                raise ValueError()
            body = json.loads(self.rfile.read(length))
            session = body['session']
            if not UUID.fullmatch(session):
                raise ValueError()
            path = urlsplit(self.path).path
            with closing(sqlite3.connect(self.server.database, timeout=10)) as db, db:
                if path == '/api/events':
                    events = body['events']
                    if not isinstance(events, list) or not 1 <= len(events) <= 100:
                        raise ValueError()
                    for event in events:
                        seq, ts, kind, page, control = event
                        if (type(seq) is not int or seq < 1 or type(ts) is not int
                                or kind not in ('click', 'view', 'invalid')
                                or page not in PAGES or not CONTROL.fullmatch(control)):
                            raise ValueError()
                        db.execute('INSERT OR IGNORE INTO events(session, seq, client_ms, kind, page, control) VALUES(?,?,?,?,?,?)',
                                   (session, seq, ts, kind, page, control))
                elif path == '/api/submissions':
                    campus, department, day, slot, fields = body['form']
                    values = (campus, department, day, slot, fields)
                    if any(type(v) is not int or not 0 <= v <= limit
                           for v, limit in zip(values, (4, 8, 3, 2, 511))):
                        raise ValueError()
                    doctor = body.get('doctor')
                    if doctor is not None and (type(doctor) is not int or not 0 <= doctor < 27 or doctor // 3 != department):
                        raise ValueError()
                    if doctor is not None and self.server.doctors[doctor]['schedule'][day] != 'available':
                        raise ValueError()
                    details = body['details']
                    if not isinstance(details, list) or len(details) != 5 or any(
                            not isinstance(value, str) or len(value) > limit
                            for value, limit in zip(details, (20, 18, 11, 6, 100))):
                        raise ValueError()
                    db.execute("""INSERT OR IGNORE INTO submissions
                               (session,campus,department,day,slot,fields,name,id_number,phone,verification_code,address,doctor)
                               VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""", (session, *values, *details, doctor))
                else:
                    self.send_error(404)
                    return
        except (ValueError, KeyError, TypeError, OverflowError):
            self.send_error(400, 'Invalid record')
            return
        except sqlite3.Error:
            self.send_error(503, 'Storage unavailable')
            return
        self.send_response(204)
        self.end_headers()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8767)
    parser.add_argument('--bind', default='0.0.0.0')
    parser.add_argument('--database', type=Path, default=ROOT / 'data' / 'study.sqlite3')
    args = parser.parse_args()
    args.database.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(args.database)) as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS events (
              session TEXT, seq INTEGER, client_ms INTEGER, kind TEXT, page TEXT, control TEXT,
              received_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(session,seq)
            );
            CREATE TABLE IF NOT EXISTS submissions (
              session TEXT PRIMARY KEY, campus INTEGER, department INTEGER, day INTEGER,
              slot INTEGER, fields INTEGER, submitted_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        """)
        columns = {row[1] for row in db.execute('PRAGMA table_info(submissions)')}
        for column in ('name', 'id_number', 'phone', 'verification_code', 'address'):
            if column not in columns:
                db.execute(f'ALTER TABLE submissions ADD COLUMN {column} TEXT')
        if 'doctor' not in columns:
            db.execute('ALTER TABLE submissions ADD COLUMN doctor INTEGER')
        db.execute('CREATE TABLE IF NOT EXISTS doctors (id INTEGER PRIMARY KEY, name TEXT, department INTEGER, title TEXT, bio TEXT, portrait INTEGER)')
        doctor_data = json.loads((ROOT / 'doctors.js').read_text().split('=', 1)[1].rstrip(';\n'))
        for doctor in doctor_data:
            db.execute('INSERT OR REPLACE INTO doctors VALUES(?,?,?,?,?,?)',
                       tuple(doctor[k] for k in ('id','name','department','title','bio','portrait')))
        db.commit()
    with ThreadingHTTPServer((args.bind, args.port), Handler) as server:
        server.database = args.database
        server.doctors = doctor_data
        print(f'Listening on {args.bind}:{args.port}', flush=True)
        server.serve_forever()
