# Mobile APK CTA — Design Spec

**Date:** 2026-05-27
**Status:** Approved

## Goal

Add a dedicated Android early-access CTA section to the landing page so that brave early testers can download the APK directly, before the app is published on the Play Store.

No waitlist, no email collection — just a download link.

## Placement

New `MobileAppSection` component inserted in `LandingPage.tsx` between `FAQSection` and `FinalCTASection`.

## Component Design

Single centered card matching the existing design language (`bg-[#1c1c1c]`, `border border-white/10`, `rounded-2xl`).

Card contents (top to bottom):
1. Android icon (Lucide `Smartphone` or similar) in a green-tinted circle
2. Green uppercase label: `"Android App · Early Access"`
3. Headline: `"Take time24 with you"`
4. Body copy: `"The native Android app is in early access. Install the APK and try it before it hits the Play Store."`
5. Primary green download button: `"Download APK"` — `<a href={apkUrl} download>` linking to the Supabase Storage public URL
6. Small disclaimer: `"Android 8.0+ · Enable 'Install from unknown sources' in Settings"`
7. Quiet footnote: `"iOS coming soon"`

Animations: `FadeUp` wrapper (consistent with other sections). Button uses the same `whileHover / whileTap` scale pattern as existing CTAs.

## APK URL Configuration

- Env var: `NEXT_PUBLIC_APK_URL` in `.env.local`
- The section **only renders** when `NEXT_PUBLIC_APK_URL` is set (non-empty). This allows the landing to deploy cleanly before the APK is uploaded.
- The user uploads the APK to Supabase Storage (public bucket) and pastes the resulting URL into `.env.local`.

## FAQ Update

The existing FAQ entry "Is there a mobile app?" answer is updated from:

> "A native iOS and Android app is currently in development — sign up to get notified when it launches."

To:

> "The Android app is available as an early-access APK — scroll down to the Android section to download it. iOS is coming soon. Sign up to the web app to stay in the loop."

## Out of Scope

- Waitlist / email collection
- iOS download
- Play Store / App Store badges (added later once published)
- Any backend changes or new Supabase tables

## Files Changed

| File | Change |
|------|--------|
| `components/marketing/LandingPage.tsx` | Add `MobileAppSection` component, insert between `FAQSection` and `FinalCTASection`, update FAQ answer |
| `.env.local` | Add `NEXT_PUBLIC_APK_URL=` (user fills in after uploading APK) |
