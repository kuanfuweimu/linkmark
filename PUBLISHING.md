# Publish Linkmark from your personal Figma account

This is a **classic plugin**, not a generative plugin. Publishing the GitHub repository does not publish the plugin to Figma Community.

## Prepare your personal account

1. Use the Figma desktop app and sign in to the personal account that should own Linkmark.
2. Enable two-factor authentication on that account. Figma requires it to publish or update a classic plugin.
3. Open a Design file in your personal Drafts. Check the current account before publishing; do not select the company team or organization as the publisher.
4. Run the development plugin and verify the items below before submission.

The local manifest currently uses `linkmark-local`, a development-only ID. It is not a Community ID and is not attached to a Figma account. At publication, use the ID assigned by Figma to your personal plugin. If Figma asks for a valid ID, create a new **Custom UI** development plugin from the personal account in a separate temporary folder, copy its assigned `id` into this project's `manifest.json`, and re-import this manifest. Do not overwrite the implementation with the generated starter files. Keep that ID for future updates.

## Runtime checks before submitting

- Import and open Linkmark in the actual Figma desktop editor.
- Fetch a public URL with an image and insert both vertical and horizontal cards.
- Confirm title, description and source are editable; open the original link.
- Test a page without an image and the manual-entry workflow.
- Upload a local JPG or PNG cover and insert it.
- Check long titles, empty descriptions, light/dark panel themes and unavailable image URLs.
- Close and reopen the plugin; confirm the relaunch entry works.

Automated source tests and API type checks cannot replace these editor checks. The provided UI preview is a design illustration, not a screenshot of a completed editor test.

## Submit to Community

In a Design file in the desktop app, open **Plugins → Manage plugins**, find Linkmark, open its menu and select **Publish**.

Use the following listing copy:

**Name**

Linkmark

**Tagline**

Turn links into editable bookmark cards.

**Description**

Paste a public URL and turn it into a clean bookmark card in Figma Design. Preview the cover, title, description and source before adding it to your canvas.

- Fetch page titles, descriptions, covers and website icons.
- Switch between vertical and horizontal layouts.
- Edit text, replace the cover or upload your own image.
- Insert editable layers with Auto Layout and links to the original page.
- Use manual entry when a website cannot be previewed.

Automatic previews use the public Microlink API, which has a free daily limit and may not support every website. No API key is required. Manual entry remains available when preview requests fail. Linkmark creates static cards; it does not embed live websites or play videos.

Linkmark is an independent plugin inspired by bookmark previews. It is not affiliated with Figma or Microlink.

**Suggested category:** Design tools

**Suggested tags, if offered:** bookmarks, links, references, moodboard, productivity

**Assets:** `assets/icon.png` (128 × 128) and `assets/community-cover.png` (1920 × 1080). The cover is a product illustration. Add real screenshots after editor testing if you want to show runtime evidence.

**Support contact:** use the Issues URL of the published GitHub repository, or a support contact you control.

**Publisher:** select your personal profile. If a destination chooser appears, choose **Community**, not the company organization.

**Network disclosure:** unrestricted domains are needed for website cover images and favicons. Public URL metadata is fetched from `api.microlink.io`. Use [PRIVACY.md](PRIVACY.md) as the basis for any data-security answers; do not claim the plugin is offline.

Click **Publish** to submit for review. The first submission is reviewed by Figma; approval timing varies. Review and update instructions come to the Figma account associated with the submission.

## Official references

- [Publish classic plugins](https://help.figma.com/hc/en-us/articles/360042293394-Publish-classic-plugins-to-the-Figma-Community)
- [Create a development plugin](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development)
- [Plugin manifest and IDs](https://developers.figma.com/docs/plugins/manifest/)
- [Publishing checks](https://developers.figma.com/docs/plugins/publishing/)

Checked against the official documentation on 2026-10-30.
