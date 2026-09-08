tell application "Google Chrome"
    activate
end tell

tell application "System Events"
    tell process "Google Chrome"
        -- Type text using keystroke and tab navigation
        keystroke "v" using {command down}
    end tell
end tell
