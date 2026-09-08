import dns.resolver
import sys

emails = [
    "bl10buer@gmail.com",
    "depin@borderlesscapital.io",
    "pitch@ev3.company",
    "hello@multicoin.capital",
    "accelerator@iotex.io",
    "basecamp@outlierventures.io",
    "contact@foresightventures.com",
    "pitch@l2iv.com",
    "hello@mhventures.io",
    "contact@cogitent.ventures",
    "pitch@primalcapital.io",
    "info@advancedblockchain.com",
    "contact@moonrockcapital.io",
    "contact@arcanegroup.io",
    "deals@wagmi.ventures",
    "contact@woodstockfund.com",
    "pitch@panteracapital.com",
    "deals@coinfund.io",
    "team@1kx.capital",
    "pitch@fabric.vc",
    "info@maven11.com",
    "info@mechanism.capital",
    "spartanlabs@spartangroup.io",
    "hello@dragonfly.xyz",
    "contact@ngc.fund",
    "contact@snzholding.com",
    "investment@animocabrands.com",
    "pitch@shima.capital",
    "hello@hypersphere.ventures",
    "gm@bigbrain.holdings",
    "contact@morningstar.ventures",
    "grants@base.org",
    "grants@arbitrum.foundation",
    "grants@optimism.io",
    "apply@alliance.xyz",
    "ventures@coinbase.com",
    "labs@binance.com",
    "ventures@okx.com",
    "capital@hashkey.com",
    "contact@fenbushi.vc",
    "info@kr1.io",
    "info@signum.capital",
    "bp@ldcap.com",
    "contact@waterdrip.io",
    "contact@7xvc.com",
    "ventures@kucoin.com"
]

checked_domains = {}

print(f"Toplam doğrulanacak e-posta: {len(emails)}\n")

for email in emails:
    domain = email.split('@')[1]
    if domain not in checked_domains:
        try:
            answers = dns.resolver.resolve(domain, 'MX')
            mx_hosts = [str(r.exchange) for r in answers]
            checked_domains[domain] = {"status": "ACTIVE_MX", "mx": mx_hosts[0]}
        except Exception as e:
            checked_domains[domain] = {"status": "FAILED_MX", "error": str(e)}
    
    info = checked_domains[domain]
    if info["status"] == "ACTIVE_MX":
        print(f"✅ {email:<35} -> ALICI SUNUCU AKTİF ({info['mx']})")
    else:
        print(f"❌ {email:<35} -> HATA: {info.get('error', 'MX Yok')}")
