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
  ]);
  const refresh = () => {
    document.querySelectorAll('button, a').forEach((element) => {
      const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
      if ((!text.includes('Create a Free Post') && !text.includes('Sign up / Log in')) || element.dataset.vowchPortalCta) return;
      element.dataset.vowchPortalCta = 'true'; element.setAttribute('aria-label', 'Sign up or log in to Vowch');
      element.querySelectorAll('.btn-main__text').forEach((node) => { node.textContent = 'Sign up / Log in'; node.setAttribute('data-text', 'Sign up / Log in'); });
      element.addEventListener('click', (event) => { event.preventDefault(); window.location.assign(portalUrl); });
    });
    document.querySelectorAll('img[alt]').forEach((image) => { if (brandNames.has(image.alt)) (image.closest('li') || image).remove(); });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => { const text = node.nodeValue?.trim(); if (text && copy.has(text)) node.nodeValue = node.nodeValue.replace(text, copy.get(text)); });
    document.querySelectorAll('video').forEach((video) => video.setAttribute('poster', '/images/bengaluru-community.jpg'));
    document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach((link) => link.setAttribute('href', '/favicon/favicon.svg'));
  };
  document.addEventListener('DOMContentLoaded', refresh);
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
})();
