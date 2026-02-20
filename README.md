# CHARUSAT Attendance Manager

A tool for CHARUSAT students to check their eGovernance attendance and see how many lectures they can skip while staying above the minimum attendance requirements.

- **75% overall** minimum attendance
- **70% per subject** minimum attendance

## Features

- 🔐 Login with your eGovernance credentials (nothing stored)
- 📊 View attendance for all subjects — lectures and labs
- 🟢🟡🟠🔴 Color-coded severity indicators
- 🧮 **Skip calculator** — tells you exactly how many lectures you can safely skip per subject
- ⚠️ **Deficit alerts** — if you're below threshold, shows how many you need to attend to recover
- 📈 Highlights **Lecture Gross** (what CHARUSAT shows) and **Overall** (lectures + labs combined)

## Quick Start

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Start backend (Terminal 1)
cd server && npm start

# 3. Start frontend (Terminal 2)
cd client && npm run dev

# 4. Open http://localhost:5173
```

## How It Works

1. You enter your eGovernance username and password
2. The backend authenticates with CHARUSAT's eGovernance portal and fetches your attendance
3. Skip calculations are applied and results are displayed in the dashboard

**Your credentials are sent directly to CHARUSAT's servers.** They are not stored, logged, or transmitted anywhere else.

## Project Structure

```
attendance_manager/
├── server/                  # Node.js + Express backend
│   ├── scraper.js           # eGov auth & attendance fetching
│   ├── calculator.js        # Skip formula & severity logic
│   ├── routes.js            # API endpoints
│   ├── index.js             # Express entry point
│   ├── test-calculator.js   # Unit tests (21 tests)
│   └── test-scraper.js      # Live scraper test
├── client/                  # React + Vite frontend
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       └── components/
│           ├── LoginForm.jsx
│           ├── AttendanceDashboard.jsx
│           └── SubjectRow.jsx
└── README.md
```

## Skip Calculation Formula

```
skippable = floor((present - threshold × total) / (1 - threshold))
```

- If **positive**: you can skip that many more lectures
- If **negative**: you need to attend that many consecutive lectures to recover

## Credits

This project was inspired by and built upon the work from the [CHARUSAT Unofficial API](https://github.com/aditya76-git/charusat-unofficial-api) by [@aditya76-git](https://github.com/aditya76-git). The authentication flow and attendance parsing logic were adapted from that project. Thank you for the groundwork! 🙏

## ⚠️ Disclaimer

> **This tool is provided "as is", for educational and personal use only.**
>
> - This project is **not affiliated with, endorsed by, or associated with CHARUSAT University** in any way.
> - The developers of this tool **do not take any responsibility** for how it is used or for any consequences arising from its use.
> - **Use this tool responsibly.** It is meant to help you stay informed about your attendance, not to encourage skipping lectures recklessly.
> - Attendance policies may change. Always verify with your institution's official records.
> - By using this tool, you acknowledge that you are solely responsible for your attendance decisions and academic standing.
>
> **Please attend your classes.** This tool is a planning aid, not an excuse to skip.

## License

MIT
