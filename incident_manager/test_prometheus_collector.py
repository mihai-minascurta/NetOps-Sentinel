from importlib import reload
import unittest
from unittest.mock import patch

from .investigation.collectors import prometheus


class PrometheusCollectorTests(unittest.TestCase):
    def test_query_url_with_and_without_environment_override(self):
        self.addCleanup(reload, prometheus)
        cases = (
            ({}, "http://localhost:9090/api/v1/query"),
            ({"PROMETHEUS_URL": "http://prometheus:9090/"}, "http://prometheus:9090/api/v1/query"),
        )

        for environment, expected_url in cases:
            with self.subTest(environment=environment), patch.dict("os.environ", environment, clear=True):
                reload(prometheus)
                with patch.object(prometheus.requests, "get") as get:
                    get.return_value.json.return_value = {"status": "success", "data": {"result": []}}

                    self.assertEqual(prometheus.query_prometheus("up"), [])

                    get.assert_called_once_with(expected_url, params={"query": "up"}, timeout=5)
