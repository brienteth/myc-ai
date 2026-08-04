"""
MYCA GitHub Reader Skill Package
Reads GitHub repositories, README files, open issues, or file trees via GitHub REST API or gh CLI.
Zero extra pip dependencies required.
"""
import logging
import asyncio
import httpx
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.skills.github_reader")

class GitHubReadInputs(BaseModel):
    repo: str = Field(description="GitHub repository in 'owner/repo' format or full URL")
    resource: str = Field(default="readme", description="Resource type: 'readme', 'repo', 'issues', or specific file path e.g. 'pyproject.toml'")
    github_token: str = Field(default="", description="Optional GitHub Personal Access Token for higher rate limits")

class GitHubReadOutputs(BaseModel):
    repo: str = Field(description="Owner/repo identifier")
    resource: str = Field(description="Requested resource name")
    content: str = Field(description="Retrieved markdown or text content")
    star_count: int = Field(default=0, description="Repository star count")

@skill(
    id="github.read",
    name="GitHub Repository Reader",
    description="Reads GitHub repository README, metadata, issues, or specific code files.",
    version="1.0.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=GitHubReadInputs,
    outputs=GitHubReadOutputs
)
async def read_github(ctx, repo: str, resource: str = "readme", github_token: str = "") -> SkillResult:
    logger.info(f"[GITHUB_READER] Reading repo '{repo}', resource '{resource}'")
    
    # Normalize repo format
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].strip("/")
    if repo.endswith(".git"):
        repo = repo[:-4]
    
    parts = repo.split("/")
    if len(parts) < 2:
        return SkillResult(success=False, logs=[f"Invalid GitHub repository format: '{repo}'. Expected 'owner/repo'."])
    
    owner, repo_name = parts[0], parts[1]
    clean_repo = f"{owner}/{repo_name}"

    # Attempt 1: gh CLI if available
    try:
        if resource == "readme":
            proc = await asyncio.create_subprocess_exec(
                "gh", "repo", "view", clean_repo,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0 and stdout:
                content = stdout.decode("utf-8")
                return SkillResult(
                    success=True,
                    outputs={"repo": clean_repo, "resource": resource, "content": content, "star_count": 0},
                    logs=[f"Successfully fetched GitHub README via gh CLI for {clean_repo}"]
                )
    except Exception:
        pass

    # Attempt 2: GitHub Public REST API
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "MYCA-Agent-OS"
    }
    if github_token:
        headers["Authorization"] = f"token {github_token}"

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        try:
            # First fetch repo metadata for stars & description
            repo_res = await client.get(f"https://api.github.com/repos/{clean_repo}", headers=headers)
            stars = 0
            description = ""
            if repo_res.status_code == 200:
                data = repo_res.json()
                stars = data.get("stargazers_count", 0)
                description = data.get("description", "")

            if resource in ("readme", ""):
                readme_res = await client.get(f"https://api.github.com/repos/{clean_repo}/readme", headers=headers)
                if readme_res.status_code == 200:
                    raw_url = readme_res.json().get("download_url", f"https://raw.githubusercontent.com/{clean_repo}/main/README.md")
                    raw_res = await client.get(raw_url, headers=headers)
                    content = raw_res.text if raw_res.status_code == 200 else f"# {clean_repo}\n{description}"
                else:
                    content = f"# {clean_repo}\n{description}"
            elif resource == "issues":
                issues_res = await client.get(f"https://api.github.com/repos/{clean_repo}/issues?state=open&per_page=10", headers=headers)
                if issues_res.status_code == 200:
                    issues_data = issues_res.json()
                    lines = [f"# Open Issues for {clean_repo}\n"]
                    for issue in issues_data:
                        lines.append(f"- [#{issue.get('number')}] **{issue.get('title')}** by @{issue.get('user', {}).get('login')}")
                    content = "\n".join(lines)
                else:
                    content = f"Could not fetch issues for {clean_repo}"
            else:
                # Specific file path inside repo
                raw_file_url = f"https://raw.githubusercontent.com/{clean_repo}/main/{resource.lstrip('/')}"
                file_res = await client.get(raw_file_url, headers=headers)
                content = file_res.text if file_res.status_code == 200 else f"File '{resource}' not found in {clean_repo}"

            return SkillResult(
                success=True,
                outputs={
                    "repo": clean_repo,
                    "resource": resource,
                    "content": content[:20000],
                    "star_count": stars
                },
                logs=[f"Successfully retrieved GitHub resource '{resource}' for {clean_repo}"]
            )
        except Exception as e:
            logger.error(f"[GITHUB_READER] Error fetching GitHub data for {clean_repo}: {e}")
            return SkillResult(success=False, logs=[f"Error fetching GitHub repository: {str(e)}"])
