# Security

The hub is a static page with no server, no accounts and no stored data beyond the visitor's own browser storage.
The most serious problems here would be:

- anything that could **change the tip details** a visitor sees or copies (the Binance Pay link, the Bitcoin address, the QR codes),
- a way to **run script** on the page, for example through a crafted challenge link (`?c=…&n=…`),
- a way to get the page to **load content from another site** despite its security policy.

Please report these privately through
[GitHub's private vulnerability reporting](https://vicecityhub.okenshop.com/security-report),
not in a public issue. You'll get a reply as soon as the maintainer sees it.

Anything else, such as layout bugs or typos, is fine as a normal issue.
