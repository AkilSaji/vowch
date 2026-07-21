(() => {
  const portalUrl = 'https://vowch-client.vercel.app';
  const brandNames = new Set(['Chanel', 'Nespresso', 'Vanguart', 'Tissot']);
  const copy = new Map([
    ['New posts appear near you every day.', 'New requests appear across Bengaluru every day.'],
    ['Need help moving a sofa this Saturday.', 'Need help moving a sofa in Indiranagar this Saturday.'],
    ['Math tutor available for high-school students.', 'Math tutor available for CBSE students in Koramangala.'],
    ['Photographer needed for a small event.', 'Photographer needed for a small event in HSR Layout.'],
    ['Available for delivery and errands.', 'Available for errands and delivery in Whitefield.'],
    ['Europe', 'Indiranagar, Bengaluru'], ['US', 'Koramangala, Bengaluru'], ['UK', 'HSR Layout, Bengaluru'], ['Australia', 'Whitefield, Bengaluru'],
    ['Helpful people you can count on.', 'Helpful people across Bengaluru you can count on.'],
    ['From home help to short-term gigs, Vowch connects you with reliable people nearby.', 'From home help to short-term gigs, Vowch connects Bengaluru neighbours through trusted local work.'],
    ['Tell the community what you need.', 'Tell Bengaluru what you need.'], ['Trusted by real people', 'Built for Bengaluru neighbours'],
    ['Create a Free Post', 'Sign up / Log in'], ['€NaN/month', 'Free to use'],
  ]);
  const templateFragments = [
    'finished work with a true creative eye, always flexible and quick to respond.',
    'Whether it’s a rebrand, marketing campaign, product launch, or something else, our team is the one you employ when you ensure the best outcome possible.',
    '‘extremely well’. We will integrate into your existing workflow, so you’ll feel from day one that we are part of your team.',
    '‘quality’. We are a team of two senior developers who share a real enthusiasm for always delivering the best work possible.',
    'and experienced developers:',
    'into your current processes and tools.',
    'and can accommodate various timelines. Please reach out to discuss your specific needs and schedule.',
    'Sure, we can work quicker when required. We can also work under pressure. But never at the cost of quality. We truly believe in that. Looking at ‘Consistency’, we feel that this is the real benefit of incredibles. Because there’s two of us working as one unit, we can maintain continuity and split work efficiently to keep even the most complex builds moving quickly.',
  ];
  const removeAgencySurfaces = () => {
    // The exported starter site included an agency price calculator and enquiry dialog.
    // Vowch sends people directly into the product instead of collecting project briefs.
    document.querySelectorAll('.s-pricing, .s-modal, [aria-label="Contact form"]').forEach((element) => element.remove());
    document.querySelectorAll('section').forEach((section) => {
      const className = String(section.className || '').toLowerCase();
      const text = section.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
      if (
        className.includes('pricing') ||
        className.includes('calculator') ||
        /project enquiry|project information|price range|budget range|estimated timeline/.test(text)
      ) section.remove();
    });
    document.querySelectorAll("a[href*='pricing'], a[href*='calculator']").forEach((link) => (link.closest('li') || link).remove());
    document.querySelectorAll('button, a').forEach((element) => {
      const text = element.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
      if (text === 'pricing' || text === 'price calculator') (element.closest('li') || element).remove();
    });
    document.querySelectorAll('footer .s__contact, footer .s__socials, footer a[href^="mailto:"], footer a[href*="incredibles.dev"], footer a[href*="linkedin.com/company/incredibles"]').forEach((element) => (element.closest('.s__contact, .s__socials') || element).remove());
  };
  const refresh = () => {
    removeAgencySurfaces();
    document.querySelectorAll('button, a').forEach((element) => {
      const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (text.includes('View project')) {
        element.setAttribute('href', portalUrl);
        element.setAttribute('aria-label', 'View this opportunity in Vowch');
      }
      if ((text.includes('Create a Free Post') || text.includes('Sign up / Log in')) && !element.dataset.vowchPortalCta) {
        element.dataset.vowchPortalCta = 'true'; element.setAttribute('aria-label', 'Sign up or log in to Vowch');
        element.querySelectorAll('.btn-main__text').forEach((node) => { node.textContent = 'Sign up / Log in'; node.setAttribute('data-text', 'Sign up / Log in'); });
      }
    });
    document.querySelectorAll('img[alt]').forEach((image) => { if (brandNames.has(image.alt)) (image.closest('li') || image).remove(); });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.nodeValue?.trim();
      if (!text) return;
      if (copy.has(text)) node.nodeValue = node.nodeValue.replace(text, copy.get(text));
      templateFragments.forEach((fragment) => {
        if (node.nodeValue?.includes(fragment)) node.nodeValue = node.nodeValue.replace(fragment, '');
      });
    });
    document.querySelectorAll("a[href*='incredibles.dev'], a[href*='wodniack.dev'], a[href*='gsepartners.net'], a[href*='hypernova.xyz'], a[href*='frothstop.com.au']").forEach((link) => {
      link.setAttribute('href', portalUrl);
      if (link.textContent?.includes('View project')) link.textContent = 'View in Vowch';
    });
    document.querySelectorAll('video').forEach((video) => video.setAttribute('poster', '/images/bengaluru-community.jpg'));
    document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach((link) => link.setAttribute('href', '/favicon/favicon.svg'));
  };
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-vowch-portal-cta]') : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(portalUrl);
  }, true);
  document.addEventListener('DOMContentLoaded', refresh);
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
})();
