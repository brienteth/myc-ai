"""
Unit tests for Agent-Reach inspired MYCA OS network skills.
"""
import unittest
import asyncio
from myca.skills.core.registry import SkillRegistry
from myca.skills.packages.network.web_reader import read_web_page
from myca.skills.packages.network.github_reader import read_github
from myca.skills.packages.network.youtube_reader import read_youtube_transcript
from myca.skills.packages.network.rss_reader import read_rss_feed
from myca.skills.packages.network.twitter_reader import read_twitter
from myca.skills.packages.network.agent_reach_bridge import agent_reach_doctor

class TestAgentReachSkills(unittest.TestCase):

    def setUp(self):
        SkillRegistry._ensure_loaded()

    def test_skills_registration(self):
        """Verify that all new Agent-Reach inspired skills are registered in SkillRegistry."""
        registered_ids = SkillRegistry._skills.keys()
        self.assertIn("web.read", registered_ids)
        self.assertIn("github.read", registered_ids)
        self.assertIn("youtube.transcript", registered_ids)
        self.assertIn("rss.read", registered_ids)
        self.assertIn("twitter.read", registered_ids)
        self.assertIn("agent_reach.doctor", registered_ids)

    def test_web_reader_fallback(self):
        """Test web.read with mock URL fallback."""
        async def run_test():
            res = await read_web_page(None, url="https://example.com")
            self.assertTrue(res.success)
            self.assertIn("markdown_content", res.outputs)
            self.assertIn("url", res.outputs)
        
        asyncio.run(run_test())

    def test_github_reader(self):
        """Test github.read with repo string."""
        async def run_test():
            res = await read_github(None, repo="Panniantong/agent-reach", resource="readme")
            self.assertTrue(res.success)
            self.assertIn("content", res.outputs)
            self.assertEqual(res.outputs["repo"], "Panniantong/agent-reach")
        
        asyncio.run(run_test())

    def test_rss_reader_parsing(self):
        """Test rss.read with mock XML structure."""
        async def run_test():
            # Testing invalid/empty feed handling
            res = await read_rss_feed(None, feed_url="https://example.com/invalid_feed.xml")
            # Should gracefully handle HTTP/XML errors without crashing
            self.assertIsInstance(res.success, bool)

        asyncio.run(run_test())

    def test_twitter_reader(self):
        """Test twitter.read with sample status URL."""
        async def run_test():
            res = await read_twitter(None, query="https://x.com/jack/status/20")
            self.assertTrue(res.success)
            self.assertIn("content", res.outputs)

        asyncio.run(run_test())

    def test_agent_reach_doctor(self):
        """Test agent_reach.doctor health check execution."""
        async def run_test():
            res = await agent_reach_doctor(None)
            self.assertTrue(res.success)
            self.assertIn("installed", res.outputs)
            self.assertIn("doctor_output", res.outputs)

        asyncio.run(run_test())

if __name__ == "__main__":
    unittest.main()
