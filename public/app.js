(() => {
  const $ = (id) => document.getElementById(id);
  const show = (el, text, isErr) => { el.textContent = text; el.className = "msg" + (isErr ? " err" : ""); el.style.display = "block"; };
  if ($("yr")) $("yr").textContent = new Date().getFullYear();

  // Fill price and name from the server so the page always matches config.js
  const buyBtn = $("buy-btn");
  if (buyBtn) {
    fetch("/api/products").then((r) => r.json()).then((list) => {
      const p = list.find((x) => x.id === buyBtn.dataset.product);
      if (!p) return;
      $("p-name").textContent = p.name;
      $("p-price").textContent = new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency }).format(p.priceCents / 100);
      $("p-formats").textContent = p.formats.join(" · ");
    }).catch(() => {});

    buyBtn.addEventListener("click", async () => {
      buyBtn.disabled = true;
      buyBtn.textContent = "Opening secure checkout…";
      try {
        const r = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: buyBtn.dataset.product }),
        });
        const data = await r.json();
        if (!r.ok || !data.url) throw new Error(data.error || "Checkout failed");
        location.href = data.url;
      } catch (e) {
        show($("buy-msg"), e.message, true);
        buyBtn.disabled = false;
        buyBtn.textContent = "Buy now";
      }
    });
  }

  const form = $("link-form");
  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = $("link-btn");
      btn.disabled = true;
      try {
        const r = await fetch("/api/request-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: $("email").value }),
        });
        const data = await r.json();
        show($("link-msg"), data.message || data.error, !r.ok);
      } catch {
        show($("link-msg"), "Something went wrong. Please try again.", true);
      }
      btn.disabled = false;
    });
  }
})();
