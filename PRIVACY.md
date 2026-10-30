# Privacy

Linkmark creates static bookmark cards in Figma Design.

## Network requests

Selecting **Get preview** sends the entered URL to `https://api.microlink.io/` to retrieve public page metadata. Microlink processes that URL under its own service terms and privacy practices. The URL may include its path and query parameters, so only submit public links you intend to share with this service.

Remote covers and website icons are downloaded from the addresses returned by the metadata service, or from an image URL you explicitly enter. Those servers receive normal network request information. This is why the plugin declares unrestricted domain access in its manifest.

## Local data

- Manually entered titles and descriptions are not sent to Microlink.
- Uploaded covers are resized and converted locally, then stored as image fills in the Figma file. They are not uploaded to Microlink.
- Link metadata is cached in memory for up to 20 URLs while the plugin is open. Closing the plugin clears that cache.
- Generated cards store their source URL in the Figma document and in plugin data so the link can be reused.
- Selecting a single URL text layer or an existing Linkmark card may prefill the URL input. It does not trigger a request until you choose **Get preview**.

Linkmark does not use analytics, advertising, browser history, account credentials or authentication cookies. No API keys are bundled in its source.

Using **enter details manually** skips the metadata request. If you also use a local cover upload instead of a remote image, Linkmark makes no preview or image request for that card. Normal Figma document storage and synchronization still apply.
