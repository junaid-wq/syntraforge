(function () {
  // Replace the `url` values below with your approved affiliate tracking links
  const PARTNERS = {
    frame: {
      badge: "CREATOR WORKFLOW PARTNER",
      title: "Edit & Auto-Caption Your Videos 10x Faster",
      desc: "Turn extracted frames and raw clips into polished, studio-grade videos with AI transcription and multitrack editing.",
      cta: "Try Descript Free →",
      url: "https://www.descript.com/"
    },
    image: {
      badge: "STORE & WEB OPTIMIZATION PARTNER",
      title: "Launch a High-Converting Store with Optimized Assets",
      desc: "Put your newly compressed product photos to work on a fast, mobile-ready online storefront in minutes.",
      cta: "Start Shopify Free Trial →",
      url: "https://www.shopify.com/"
    },
    qr: {
      badge: "BUSINESS & MERCHANTS PARTNER",
      title: "Print Custom Menus, Business Cards & Flyers",
      desc: "Turn your high-resolution vector QR codes into crisp physical prints and marketing materials shipped fast.",
      cta: "Explore Vistaprint →",
      url: "https://www.vistaprint.com/"
    },
    audio: {
      badge: "AI VOICE & AUDIO STUDIO PARTNER",
      title: "Generate Ultra-Realistic AI Voiceovers & Dubs",
      desc: "Pair your trimmed audio clips with studio-quality voice cloning and multilingual AI narration.",
      cta: "Try ElevenLabs Free →",
      url: "https://elevenlabs.io/"
    }
  };

  function buildTrackedUrl(rawUrl, key) {
    try {
      const u = new URL(rawUrl);
      if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "syntraforge");
      if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", "partner_banner");
      if (!u.searchParams.has("utm_campaign")) u.searchParams.set("utm_campaign", key);
      return u.toString();
    } catch (_) {
      return rawUrl;
    }
  }

  function initPartnerBanner() {
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname.toLowerCase();

    let key = "frame";
    if (host.startsWith("image.") || path.includes("/compress")) key = "image";
    else if (host.startsWith("qr.") || path.includes("/qr")) key = "qr";
    else if (host.startsWith("audio.") || path.includes("/audio")) key = "audio";

    const partner = PARTNERS[key];
    const badgeEl = document.getElementById("sf-partner-badge");
    const titleEl = document.getElementById("sf-partner-title");
    const descEl  = document.getElementById("sf-partner-desc");
    const btnEl   = document.getElementById("sf-partner-btn");

    if (badgeEl) badgeEl.textContent = partner.badge;
    if (titleEl) titleEl.textContent = partner.title;
    if (descEl)  descEl.textContent  = partner.desc;
    if (btnEl) {
      btnEl.textContent = partner.cta;
      btnEl.href   = buildTrackedUrl(partner.url, key);
      btnEl.target = "_blank";
      btnEl.rel    = "sponsored nofollow noopener noreferrer";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPartnerBanner);
  } else {
    initPartnerBanner();
  }
})();