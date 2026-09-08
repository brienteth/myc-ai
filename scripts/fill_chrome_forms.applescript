tell application "Google Chrome"
    activate
    set report to ""
    repeat with w in windows
        repeat with t in tabs of w
            set u to (URL of t)
            
            -- 1. MULTICOIN CAPITAL
            if u contains "multicoin.capital" then
                set active tab index of w to (index of t)
                execute t javascript "
                    (function() {
                        const inputs = document.querySelectorAll('input, textarea');
                        for (let el of inputs) {
                            const name = (el.name || el.id || el.placeholder || '').toLowerCase();
                            if (name.includes('name')) el.value = 'MYCA Core Team';
                            if (name.includes('email') || el.type === 'email') el.value = 'enterprise@mycai.pro';
                            if (el.tagName === 'TEXTAREA' || name.includes('message')) {
                                el.value = 'MYCA Network (Chain ID 108) is the world first zero-gas, post-quantum DePIN substrate featuring Silicon PUF machine identities, 4.95us Safe-Sign C99 bare-metal hardware safety interlocks, and 100% offline air-gapped DTN mesh operation. Live testnet on Chain ID 108 with 15,147+ TPS and sub-10ms finality. Seed Round: $2M at $20M Valuation ($0.20/MYC). Live Explorer: https://mycai.pro/depin/explorer | Docs: https://mycai.pro/depin/docs | Pitch Contact: enterprise@mycai.pro';
                            }
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    })();
                "
                set report to report & "Multicoin form populated. " & linefeed
            end if

            -- 2. PANTERA CAPITAL
            if u contains "panteracapital.com" then
                execute t javascript "
                    (function() {
                        const inputs = document.querySelectorAll('input, textarea');
                        for (let el of inputs) {
                            const name = (el.name || el.id || el.placeholder || '').toLowerCase();
                            if (name.includes('name') || name.includes('first')) el.value = 'MYCA';
                            if (name.includes('last')) el.value = 'Network';
                            if (name.includes('email') || el.type === 'email') el.value = 'enterprise@mycai.pro';
                            if (el.tagName === 'TEXTAREA' || name.includes('message')) {
                                el.value = 'MYCA Network (Chain ID 108) - $2M Seed Round Dossier. Zero-Gas Silicon PUF DePIN & Autonomous Machine Economy Substrate. 15,147+ TPS, Sub-10ms Finality, 10-Pillar Post-Quantum Armor, 100% Offline Air-Gapped DTN Mesh. Live Testnet & Explorer: https://mycai.pro/depin/explorer | Docs: https://mycai.pro/depin/docs';
                            }
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    })();
                "
                set report to report & "Pantera form populated. " & linefeed
            end if

            -- 3. ANIMOCA BRANDS
            if u contains "animocabrands.com" then
                execute t javascript "
                    (function() {
                        const inputs = document.querySelectorAll('input, textarea');
                        for (let el of inputs) {
                            const name = (el.name || el.id || el.placeholder || '').toLowerCase();
                            if (name.includes('name')) el.value = 'MYCA Core Engineering';
                            if (name.includes('email') || el.type === 'email') el.value = 'enterprise@mycai.pro';
                            if (el.tagName === 'TEXTAREA' || name.includes('message')) {
                                el.value = 'MYCA Network: Autonomous Gaming Worlds & Zero-Gas Living Assets (ERC-721R). Sovereign NPCs with persistent holographic memory and 60+ moves/sec at 0.00000000 gas. Live Testnet on Chain ID 108. Contact: enterprise@mycai.pro';
                            }
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    })();
                "
                set report to report & "Animoca form populated. " & linefeed
            end if

            -- 4. EV3 (Escape Velocity)
            if u contains "ev3.company" then
                execute t javascript "
                    (function() {
                        const inputs = document.querySelectorAll('input, textarea');
                        for (let el of inputs) {
                            const name = (el.name || el.id || el.placeholder || '').toLowerCase();
                            if (name.includes('name')) el.value = 'MYCA Core Team';
                            if (name.includes('email') || el.type === 'email') el.value = 'enterprise@mycai.pro';
                            if (el.tagName === 'TEXTAREA' || name.includes('message')) {
                                el.value = 'MYCA Network: Specialized DePIN Substrate for IoT, Robotics & Clean Energy. Silicon PUF W3C DIDs, 4.95us C99 Bare-Metal Hardware Safety Interlock, and Air-Gapped DTN Mesh. Raising $2M Seed. Explorer: https://mycai.pro/depin/explorer | Email: enterprise@mycai.pro';
                            }
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    })();
                "
                set report to report & "EV3 form populated. " & linefeed
            end if

            -- 5. COINFUND
            if u contains "coinfund.io" then
                execute t javascript "
                    (function() {
                        const inputs = document.querySelectorAll('input, textarea');
                        for (let el of inputs) {
                            const name = (el.name || el.id || el.placeholder || '').toLowerCase();
                            if (name.includes('name')) el.value = 'MYCA Network';
                            if (name.includes('email') || el.type === 'email') el.value = 'enterprise@mycai.pro';
                            if (el.tagName === 'TEXTAREA' || name.includes('message')) {
                                el.value = 'MYCA Network: Cryptographic AI & DePIN Infrastructure. Chain ID 108, Zero-Gas, 10-Pillar Post-Quantum Armor, 100% Offline Air-Gapped Operation. Seed round: $2M. https://mycai.pro/depin/explorer';
                            }
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    })();
                "
                set report to report & "CoinFund form populated. " & linefeed
            end if

        end repeat
    end repeat
    return report
end tell
