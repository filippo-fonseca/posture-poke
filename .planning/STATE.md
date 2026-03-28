# SpineSync - Project State

**Project:** SpineSync - Funny posture detector hackathon project
**Created:** 2026-03-28
**Current Milestone:** v1 - Hackathon Demo

## Description
A posture detection system using Arduino IMU sensor that streams tilt data to a web dashboard via WebSocket. When bad posture is detected, it triggers funny reactions (fart sounds, AI coach tips, voice alerts). Built for hackathon demo.

## Architecture
- Arduino firmware (BMI270 IMU) -> Serial/BLE -> Python FastAPI server -> WebSocket -> Next.js React dashboard
- Simulation mode available (no hardware needed)
- Single-page app with real-time charts, angle gauge, stats, and AI coach tips

## Key Decisions
- Next.js 16 + React 19 + Tailwind CSS + Framer Motion + Recharts
- FastAPI backend with WebSocket streaming at 20Hz
- Direct browser API calls to Anthropic/ElevenLabs (hackathon shortcut)
- Three server variants: simulator, serial, BLE (not yet unified)

## Current State
- Basic web dashboard functional with live chart, history chart, angle gauge, stats row, coach tips
- Fart sound files downloaded to sounds/ directory
- UI needs refactoring and graph fixes
