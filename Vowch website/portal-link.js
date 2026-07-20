(() => {
  const portalUrl = 'https://client-vowch.vercel.app';
  const isMemberCta = (element) => element.textContent?.replace(/\s+/g, ' ').trim() === 'Create a Free Post';

  document.querySelectorAll('button, a').forEach((element) => {
    if (!isMemberCta(element)) return;

    element.setAttribute('aria-label', 'Sign up or log in to Vowch');
    element.querySelectorAll('.btn-main__text').forEach((text) => {
      text.textContent = 'Sign up / Log in';
      text.setAttribute('data-text', 'Sign up / Log in');
    });
    element.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.assign(portalUrl);
    });
  });
})();
