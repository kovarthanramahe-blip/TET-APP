# HTET Exam Preparation Web App

_Started 2026-09-07 05:17 UTC_

---

## User

CREATE A WEB APP FOR THE HTET PREPARATION WITH THE FOLLOWING REQUIREMENTS. Core App Modules & Key Features

1. Analytics & Progress Tracking





Dashboard: Visual representation of total hours studied, daily streaks, task completion rates, and active courses.



Study Sessions: Integrated Pomodoro timer (e.g., 25 min study / 5 min break) and stopwatch with manual logging capabilities.



Mastery Heatmaps: Topic-by-topic confidence tracking (Red: Needs Work, Yellow: Moderate, Green: Mastered).

2. Testing & Self-Assessment Engine





Quiz Builder: Capability to generate multiple-choice, true/false, fill-in-the-blank, and short-answer tests.



Spaced Repetition (SRS): Flashcard module utilizing spaced repetition algorithms (like SuperMemo/Anki) for optimal memory retention.



Mock Exam Mode: Timed test conditions with locked answers, detailed performance diagnostics, and immediate score breakdowns upon completion.

3. Content & Task Management





Syllabus & Course Manager: Hierarchical organization (Course $\rightarrow$ Module $\rightarrow$ Topic $\rightarrow$ Sub-topic).



Smart Task Manager: Daily/weekly study agendas, priority tags, and deadline countdowns.



Notes Hub: Markdown-supported note-taking editor attached directly to specific courses or topics.

4. Gamification & Retention Incentives





Streak Counters: Visual rewards for maintaining daily study habits.



Milestone Badges: Unlockable achievements for total hours, test scores, or completed modules.

Technical Requirements & Architecture





Frontend: Clean, responsive UI (e.g., React, Next.js, or Flutter) with support for Dark/Light mode and mobile responsiveness.



Backend & Database: Secure user authentication (OAuth/JWT) and relational/document database design to link users, courses, quiz attempts, and study logs.



Data Privacy: Local storage capabilities or secure cloud synchronization for personal notes and progress data.

Output Requirements

Provide a step-by-step development roadmap including:





System Architecture & Database Schema (ER diagram or JSON representation).



Key User Flows (e.g., creating a module, taking a timed quiz, viewing weekly analytics).



Core API Endpoints required for tracking and testing modules.



Starter Code Snippets for the Pomodoro timer and Spaced Repetition logic.

## Assistant



## Assistant

_[tool: ask_user]_

Waiting on your answers — mainly whether you want the working prototype, the architecture roadmap, or both, plus which modules to build deep.

## User

Answered — deliverable: Both — prototype first, roadmap doc alongside it; scope: Dashboard analytics, Pomodoro / study sessions, Mastery heatmap, Quiz + mock exam, Flashcards (SRS), Syllabus manager, Task manager, Notes hub, Gamification; content: Real HTET syllabus + sample MCQs; mode: Both with a toggle; extra: MOTIVATIONAL QUOTES ON EACH TASK IS PREFERABLE TO MOTIVATE

## Assistant

_[tool: read_file]_

_[tool: list_files]_

_[tool: grep]_

_[tool: read_file]_

Building the app now.

_[tool: dc_write]_

_[tool: copy_starter_component]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

Two files:

**HTET Prep.dc.html** — the working app. Sidebar across eight modules, level switcher (PRT/TGT/PGT with the real syllabus tree), light/dark toggle, and everything persists locally: dashboard stats + 7-day chart + mastery heatmap, Pomodoro/deep-work/stopwatch with auto-logging and manual entry, tap-to-cycle topic confidence, task agenda with deadline countdowns and a motivational quote on each open task, quiz builder with practice (instant explanations) and mock mode (one min/question, answers lock, per-part diagnostics), SM-2 flashcards, markdown notes hub, badges and streak dots. Tweaks: focus/break length and a quotes toggle.

**HTET App Roadmap.dc.html** — printable spec: architecture, ER + JSON schema, six user flows, ~20 API endpoints, and the Pomodoro + SM-2 starter code, plus a 15-week phased plan.

Note the quiz bank is 16 sample questions — a real build needs an editorial question bank. Say the word if you want the roadmap exported to PDF.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Fixed: accent ink is now a theme-aware token (`--accent-ink`, light step in dark mode) everywhere it's used as text, the dark body ground is forced to the declared value, and the design-system bundle loads in both files.

## User

RESET BUTTON IS NEEDED SINCE I HAVENT STARTED ANY STREAKS YET.

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

"Reset my progress" now sits at the bottom of the sidebar — tap once, it turns red and asks to confirm, tap again and it wipes all sample sessions, streaks, test attempts, card schedules and mastery marks so you start at zero. Syllabus, tasks and notes are left intact.

