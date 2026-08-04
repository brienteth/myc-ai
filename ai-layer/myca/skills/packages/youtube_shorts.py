import asyncio
from myca.skills.core.decorator import skill
from myca.skills.core.context import SkillContext

@skill(id="youtube.shorts_faceless_generator", permissions=["network", "browser"])
async def youtube_shorts_generator(ctx: SkillContext, niche: str, specific_topic: str = None):
    """
    Automates the process of generating faceless YouTube Shorts as described by LeoCreaIA.
    """
    ctx.emit(f"Starting YouTube Shorts Generator for niche: {niche}")
    
    # Step 1: Niche Validation & Analysis
    ctx.progress(0.1)
    validation_prompt = (
        "Act as a YouTube content strategy expert.\n"
        f"I am going to create a faceless Shorts channel in English about {niche}.\n"
        "Analyze the following: current competition level on YouTube in English, estimated monetization potential, "
        "the type of audience that consumes this content, recommended publishing frequency, and three specific angles "
        "within this niche with high demand and low competition.\n"
        "Be technical and direct. Do not include introductions."
    )
    ctx.emit("Generating niche validation strategy...")
    niche_validation = await ctx.execute("llm.generate", prompt=validation_prompt)
    
    # Step 2: Editorial Planning
    ctx.progress(0.3)
    editorial_prompt = (
        f"Act as the content director of a YouTube Shorts channel in English about {niche}.\n"
        "Create a 28-day editorial calendar with publishing from Monday to Friday (20 videos in total).\n"
        "For each video indicate: a YouTube-optimized title (60 characters max), the narrative angle "
        "(story, fact, list, question, debate), and the hook for the first 3 seconds.\n"
        "Organize the videos so each week has variety of formats."
    )
    ctx.emit("Generating 28-day editorial calendar...")
    editorial_plan = await ctx.execute("llm.generate", prompt=editorial_prompt)
    
    # Step 3: Script Writing
    ctx.progress(0.5)
    topic = specific_topic if specific_topic else niche
    script_prompt = (
        f"Write a script for a 45-second YouTube Short about {topic} for a channel in the {niche} niche.\n"
        "The script must follow this exact structure:\n"
        "HOOK (first 3 seconds): one sentence that creates immediate curiosity or tension, no introductions.\n"
        "DEVELOPMENT (35-40 seconds): fast-paced information, short sentences of no more than 12 words, one surprising fact every 8-10 seconds.\n"
        "CLOSE (5 seconds): a question that invites comments or a statement that sparks debate.\n"
        "Tone: conversational / educational / dramatic.\n"
        "120 words maximum in total. Write only the script, no scene directions or notes."
    )
    ctx.emit("Writing video script...")
    script = await ctx.execute("llm.generate", prompt=script_prompt)
    
    # Step 4: Metadata Optimization
    ctx.progress(0.7)
    metadata_prompt = (
        f"I need 5 title options for a YouTube Short about {topic}.\n"
        "The titles must: be between 40 and 60 characters, include the main keyword at the beginning when possible, "
        "create curiosity without being clickbait, and be written in clear, natural English.\n"
        "For each title, indicate in parentheses the main emotion it triggers (curiosity, surprise, fear, pride, etc).\n\n"
        f"Write the YouTube description for a Short about {topic} in the {niche} niche.\n"
        "The description must be between 100 and 150 words, include the main keyword in the first sentence, "
        "naturally mention the value the video provides, and end with a call to action to subscribe.\n"
        "Then include 8 relevant hashtags: 3 broad-niche, 3 specific-niche, and 2 trending. Write the description first and then the hashtags separately."
    )
    ctx.emit("Optimizing metadata (Titles, Description, Hashtags)...")
    metadata = await ctx.execute("llm.generate", prompt=metadata_prompt)
    
    # Step 5: Positioning Strategy
    ctx.progress(0.9)
    positioning_prompt = (
        "Act as a YouTube growth strategist.\n"
        f"I have a Shorts channel in English about {niche}.\n"
        "Give me a positioning strategy that includes: the channel's value statement in one sentence (what problem it solves, for whom, in what unique way), "
        "the three content pillars the channel should rotate to maintain variety without losing coherence, the exact profile of the ideal subscriber "
        "(age, interests, motivations), the optimal publishing frequency for the launch phase (first 90 days) and for the growth phase (from month 4 onward), "
        "and a channel name proposal that reflects the positioning.\n"
        "Be specific and practical."
    )
    ctx.emit("Generating channel positioning strategy...")
    positioning = await ctx.execute("llm.generate", prompt=positioning_prompt)
    
    ctx.progress(1.0)
    ctx.emit("YouTube Shorts workflow completed successfully.")
    
    return {
        "niche_validation": niche_validation.outputs if hasattr(niche_validation, 'outputs') else niche_validation,
        "editorial_plan": editorial_plan.outputs if hasattr(editorial_plan, 'outputs') else editorial_plan,
        "script": script.outputs if hasattr(script, 'outputs') else script,
        "metadata": metadata.outputs if hasattr(metadata, 'outputs') else metadata,
        "positioning": positioning.outputs if hasattr(positioning, 'outputs') else positioning
    }
