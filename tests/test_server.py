import json
import sqlite3
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import Handler, ThreadingHTTPServer, initialize_database, read_data

BOOKING = read_data('booking-data.js')
REGIONS = {p + c + d for p, cities in read_data('regions.js').items()
           for c, districts in cities.items() for d in districts}
SESSION, ATTEMPT = 'a' * 36, 'b' * 36


def submission(attempt=ATTEMPT, slot=0):
    return {'session': SESSION, 'attempt': attempt, 'form': [0, 0, 1, slot, 511], 'doctor': 0,
            'details': ['测试用户', '00000019601013000x', '13800000000', '012345', '测试路1号'],
            'profile': dict(name='测试用户', id='00000019601013000x', gender='女', birthday='1960-10-13',
                            height='160', weight='56.1', job='退休', region='浙江省杭州市滨江区', address='测试路1号')}


class QuietHandler(Handler):
    def log_message(self, *args):
        pass


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / 'study.sqlite3'
        initialize_database(self.db, BOOKING)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        self.server.database, self.server.booking, self.server.regions = self.db, BOOKING, REGIONS
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.post('/api/sessions', {'session': SESSION, 'name': '参与者', 'started_ms': 1000,
                                  'version': BOOKING['version'], 'conditions': {'expiry': True, 'delayed': False}})
        self.attempt(ATTEMPT)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def post(self, path, data):
        request = Request('http://127.0.0.1:%d%s' % (self.server.server_port, path),
                          data=json.dumps(data).encode(), method='POST')
        try:
            response = urlopen(request)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None

    def attempt(self, value):
        return self.post('/api/attempts', dict(session=SESSION, attempt=value, started_ms=2000,
                                             conditions={'expiry': True, 'delayed': False}))

    def rows(self, sql):
        with sqlite3.connect(self.db) as db:
            return db.execute(sql).fetchall()

    def test_versioned_resources_revalidate_instead_of_reusing_stale_scripts(self):
        for path in ('/', '/telemetry.js?v=20261109-links-1', '/app.js?v=20261109-links-1',
                     '/startup.js?v=20261109-links-1', '/entry-pages.js', '/booking-pages.js', '/patient-pages.js'):
            with urlopen('http://127.0.0.1:%d%s' % (self.server.server_port, path)) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers['Cache-Control'], 'no-cache')

    def test_all_six_illustrated_guide_assets_are_served(self):
        images = BOOKING['guideImages']
        paths = [images['home'], *images['campuses']]
        self.assertEqual(len(set(paths)), 6)
        for path in paths:
            with urlopen('http://127.0.0.1:%d/%s' % (self.server.server_port, path)) as response:
                self.assertEqual(response.status, 200)
                self.assertIn('image/webp', response.headers['Content-Type'])
                self.assertGreater(len(response.read()), 10000)

    def test_session_metadata(self):
        row = self.rows('SELECT participant_name,ip,version,conditions FROM sessions')[0]
        self.assertEqual(row[:3], ('参与者', '127.0.0.1', BOOKING['version']))
        self.assertTrue(json.loads(row[3])['expiry'])

    def test_linked_session_checks_id_and_name_before_recording_resume(self):
        linked = '9' * 36
        begin = dict(session=linked, name='链接参与者', test_id='P03', started_ms=1000,
                     version=BOOKING['version'], conditions={'expiry': False, 'delayed': False})
        self.assertEqual(self.post('/api/sessions', dict(begin, test_id='bad id'))[0], 400)
        self.assertEqual(self.post('/api/sessions', begin)[0], 204)
        self.assertEqual(self.post('/api/sessions', dict(begin, name='其他人'))[0], 400)
        body = dict(session=linked, attempt=None, return_id='8' * 36, client_ms=2000,
                    page='home', version=BOOKING['version'], test_id='P03', name='链接参与者')
        self.assertEqual(self.post('/api/resume', dict(body, name='其他人'))[0], 400)
        self.assertEqual(self.post('/api/resume', dict(body, test_id='P04'))[0], 400)
        self.assertEqual(self.rows('SELECT count(*) FROM session_returns'), [(0,)])
        self.assertEqual(self.post('/api/resume', body), (200, {'last_seq': 0}))
        self.assertIn(('P03', '链接参与者'), self.rows('SELECT test_id,participant_name FROM sessions'))

    def test_repeat_attempt_and_retry(self):
        self.assertEqual(self.post('/api/submissions', submission())[0], 204)
        self.assertEqual(self.post('/api/submissions', submission())[0], 204)
        second = 'c' * 36
        self.attempt(second)
        self.assertEqual(self.post('/api/submissions', submission(second, 3))[0], 204)
        self.assertEqual(self.rows('SELECT clinic_type,fee_fen FROM submissions ORDER BY slot'),
                         [('ordinary', 1530), ('special', 8250)])
        self.assertEqual(self.post('/api/submissions', submission(slot=3))[0], 409)

    def test_invalid_forms_and_unknown_sessions(self):
        cases = []
        bad = submission(); bad['details'][1] = '000000196010130000'; cases.append(bad)
        bad = submission(); bad['details'][2] = '138'; cases.append(bad)
        bad = submission(); bad['details'][3] = '12abcd'; cases.append(bad)
        bad = submission(); bad['profile']['birthday'] = '2000-01-01'; cases.append(bad)
        bad = submission(); bad['profile']['height'] = '160.15'; cases.append(bad)
        bad = submission(); bad['profile']['region'] = '不存在的地区'; cases.append(bad)
        bad = submission(); bad['doctor'] = 3; cases.append(bad)
        bad = submission(); bad['form'][2] = 0; cases.append(bad)  # doctor 0 is fully booked
        bad = submission(); bad['session'] = 'd' * 36; cases.append(bad)
        for data in cases:
            with self.subTest(data=data):
                self.assertEqual(self.post('/api/submissions', data)[0], 400)
        self.assertEqual(self.rows('SELECT count(*) FROM submissions'), [(0,)])

    def test_partial_event_ack_and_deduplication(self):
        good = dict(seq=1, client_ms=3000, kind='dialog', page='archive', control='region-dialog',
                    attempt=ATTEMPT, details={'result': 'confirmed'})
        bad = dict(good, seq=2, control='bad control!')
        status, result = self.post('/api/events', dict(session=SESSION, events=[good, bad]))
        self.assertEqual(status, 200)
        self.assertEqual(result['accepted'], [0])
        self.assertEqual(result['rejected'][0]['index'], 1)
        self.post('/api/events', dict(session=SESSION, events=[good]))
        self.assertEqual(self.rows('SELECT count(*) FROM events'), [(1,)])

    def test_resume_keeps_session_and_attempt_and_records_reentry_once(self):
        event = dict(seq=7, client_ms=3000, kind='view', page='archive', control='background', attempt=ATTEMPT)
        self.post('/api/events', dict(session=SESSION, events=[event]))
        body = dict(session=SESSION, attempt=ATTEMPT, version=BOOKING['version'],
                    return_id='e'*36, client_ms=4000, page='archive')
        for _ in range(2):
            status, result = self.post('/api/resume', body)
            self.assertEqual(status, 200)
            self.assertEqual(result['last_seq'], 7)
        self.assertEqual(self.rows('SELECT session,attempt,ip FROM session_returns'), [(SESSION, ATTEMPT, '127.0.0.1')])
        self.assertEqual(self.rows('SELECT count(*) FROM sessions'), [(1,)])
        self.assertEqual(self.rows('SELECT count(*) FROM attempts'), [(1,)])
        self.assertEqual(self.post('/api/resume', dict(body, attempt='f'*36))[0], 400)

    def test_legacy_migration_preserves_data(self):
        path = Path(self.tmp.name) / 'legacy.sqlite3'
        with sqlite3.connect(path) as db:
            db.execute('CREATE TABLE submissions(session TEXT PRIMARY KEY, day INTEGER, submitted_at TEXT)')
            db.execute("INSERT INTO submissions VALUES('old',2,'2026-11-01 01:02:03')")
        initialize_database(path, BOOKING)
        initialize_database(path, BOOKING)
        with sqlite3.connect(path) as db:
            self.assertEqual(db.execute('SELECT attempt,session,day,submitted_at FROM submissions').fetchone(),
                             ('legacy-old', 'old', 2, '2026-11-01 01:02:03'))


if __name__ == '__main__':
    unittest.main()
