import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Onboarding.css';

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0: Welcome, 1: Checking (Hidden), 2: Choose, 3: Downloading, 4: Connect Device, 5: Ready

  useEffect(() => {
    if (step === 1) {
      // Simulate hardware checks
      setTimeout(() => setStep(2), 2000);
    }
    if (step === 3) {
      // Simulate downloading
      setTimeout(() => setStep(4), 3000);
    }
  }, [step]);

  const handleNext = () => setStep(s => s + 1);

  return (
    <div className="onboarding-container">
      {step === 0 && (
        <div className="onboarding-slide fade-in">
          <h1>Your AI will live on your devices.</h1>
          <p className="subtitle">No cloud. No account. Just yours.</p>
          <button className="ob-btn primary" onClick={handleNext}>Continue</button>
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-slide fade-in">
          <h2>Preparing your AI...</h2>
          <div className="progress-bar-container">
            <div className="progress-bar infinite"></div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-slide fade-in">
          <h2>Choose your AI</h2>
          <div className="ai-choices">
            <button className="ai-card" onClick={handleNext}>
              <h3>Fast</h3>
              <p>For quick tasks and everyday questions.</p>
              <span className="size-badge">3 GB</span>
            </button>
            <button className="ai-card recommended" onClick={handleNext}>
              <div className="rec-badge">Recommended</div>
              <h3>Balanced</h3>
              <p>The perfect mix of speed and reasoning.</p>
              <span className="size-badge">8 GB</span>
            </button>
            <button className="ai-card" onClick={handleNext}>
              <h3>Best Quality</h3>
              <p>Advanced coding and deep logic.</p>
              <span className="size-badge">20 GB</span>
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="onboarding-slide fade-in">
          <h2>Installing Myca...</h2>
          <div className="progress-bar-container">
            <div className="progress-bar filling"></div>
          </div>
          <p className="status-text">Optimizing models for Apple Silicon...</p>
        </div>
      )}

      {step === 4 && (
        <div className="onboarding-slide fade-in">
          <h2>Would you like to connect another device?</h2>
          <p className="subtitle">Myca can pool resources from your phone, iPad, or PC.</p>
          <div className="ob-actions">
            <button className="ob-btn primary" onClick={handleNext}>Pair another device</button>
            <button className="ob-btn secondary" onClick={handleNext}>Skip for now</button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="onboarding-slide fade-in">
          <h2>Hi. I'm Myca.</h2>
          <p className="subtitle">Try asking me something.</p>
          <button className="ob-btn primary" onClick={() => navigate('/')}>Start</button>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
