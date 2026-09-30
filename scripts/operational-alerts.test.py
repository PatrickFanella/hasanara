import importlib.util
import json
import tempfile
import argparse
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("alerts", Path(__file__).with_name("operational-alerts.py"))
alerts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(alerts)


def response(body):
    result = Mock()
    result.status = 200
    result.read.return_value = body
    result.__enter__ = Mock(return_value=result)
    result.__exit__ = Mock(return_value=False)
    return result


class AlertsTest(unittest.TestCase):
    def test_health_does_not_hide_database_failure(self):
        opener = Mock()
        opener.open.side_effect = [response(b'{"status":"healthy"}'), OSError("database unavailable")]
        self.assertEqual(alerts.check("https://hasanara.tv", opener), ["/api/archive/summary"])

    def test_invalid_json_is_a_failure(self):
        opener = Mock()
        opener.open.side_effect = [response(b"<html>login</html>"), response(b"{}")]
        self.assertEqual(alerts.check("https://hasanara.tv", opener), ["/api/health"])

    def test_initial_health_incident_deduplication_and_recovery(self):
        self.assertIsNone(alerts.transition(None, []))
        self.assertEqual(alerts.transition(None, ["/api/health"]), "incident")
        self.assertIsNone(alerts.transition(["/api/health"], ["/api/health"]))
        self.assertEqual(alerts.transition(["/api/health"], []), "recovery")


    def test_provider_request_and_acceptance(self):
        opener = Mock()
        accepted = response(b'{"messageIds":["<accepted@brevo.test>"]}')
        accepted.status = 201
        opener.open.return_value = accepted
        with patch.dict(alerts.os.environ, {"BREVO_API_KEY": "test-secret"}):
            alerts.send_alert("incident", ["/api/health"], opener, "test-uuid")
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.brevo.com/v3/smtp/email")
        self.assertEqual(request.get_header("Api-key"), "test-secret")
        payload = json.loads(request.data)
        self.assertEqual(payload["messageVersions"], [{"to": [{"email": "patrick@subcult.tv"}]}])
        self.assertEqual(payload["headers"], {"idempotencyKey": "test-uuid"})

    def test_retry_keeps_uuid_and_success_deduplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            with patch.object(alerts, "send_alert", side_effect=[ValueError("timeout"), None, None]) as send:
                with self.assertRaises(ValueError):
                    alerts.notify(state, ["/api/health"], Mock())
                pending_id = json.loads(state.read_text())["pending"]["id"]
                alerts.notify(state, ["/api/health"], Mock())
                self.assertEqual(send.call_args.args[3], pending_id)
                self.assertIsNone(alerts.notify(state, ["/api/health"], Mock()))
                self.assertEqual(send.call_count, 2)
                self.assertEqual(alerts.notify(state, [], Mock()), "recovery")
                self.assertEqual(send.call_count, 3)
            self.assertEqual(state.stat().st_mode & 0o777, 0o600)

    def test_expired_uncertain_send_is_held(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            state.write_text(json.dumps({"failures": None, "pending": {"kind": "incident", "failures": ["/api/health"], "id": "same", "started": 0}}))
            with patch.object(alerts, "send_alert") as send:
                with self.assertRaisesRegex(ValueError, "operator review"):
                    alerts.notify(state, ["/api/health"], Mock())
                send.assert_not_called()

    def test_dry_run_never_sends_or_writes_state(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            with patch.object(alerts, "check", return_value=[]), patch.object(alerts, "send_alert") as send:
                self.assertEqual(alerts.run(argparse.Namespace(send=False, state=str(state))), 0)
                send.assert_not_called()
            self.assertFalse(state.exists())

    def test_provider_failure_hides_private_detail(self):
        opener = Mock()
        opener.open.side_effect = OSError("private provider body")
        with patch.dict(alerts.os.environ, {"BREVO_API_KEY": "secret"}):
            with self.assertRaisesRegex(ValueError, "^email acceptance unavailable$"):
                alerts.send_alert("incident", ["/api/health"], opener, "uuid")


if __name__ == "__main__":
    unittest.main()
