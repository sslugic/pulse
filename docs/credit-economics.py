# Credit economics model for Pulse. Run: python3 docs/credit-economics.py
# Token counts are estimates; replace with measured usageMetadata once logged. See CREDIT-ECONOMICS.md.

# Prices per 1M tokens: (input, cached input, output)
P = {
 'flash26': (0.75, 0.075, 3.75), 'flash27': (1.50, 0.15, 7.50),
 'lite':    (0.30, 0.03, 2.50),
}
TTS = {'lite26': 6.0, 'lite27': 12.0}  # audio output per 1M, 25 tok/s
def call(m, inp, out, cached=0): i,c,o = P[m]; return (inp*i + cached*c + out*o)/1e6
def tts(sec, era): return sec*25*TTS['lite'+era]/1e6 + 200*0.5/1e6

# Current implementation token estimates (static rules+schema ~2,400 tok, dynamic context+history ~1,400)
def current(era):
    f = 'flash'+era
    return {
     'coach':        call(f, 3800, 600),
     'coach_photo':  call(f, 3800+1100, 800),
     'coach_voice':  call(f, 3800+480, 600),          # 15 s voice note, 32 tok/s
     'read_aloud':   tts(15, era),
     'plan_day':     call(f, 2000, 1500),             # one day's meals or workout
     'plan_week':    call(f, 2500, 6000),
     'recap':        call(f, 2000, 400),
     'wellbeing':    call(f, 1500, 300),
     'goal':         call(f, 1500, 400),
     'insight':      call(f, 1500, 120),
     'estimate':     call(f, 600, 150),
    }
# Optimised: static prompt first (implicit cache), minimal thinking, Flash-Lite for structured/short jobs
def optimised(era):
    f = 'flash'+era
    return {
     'coach':        call(f, 1200, 400, cached=2400),
     'coach_photo':  call(f, 1200+1100, 600, cached=2400),
     'coach_voice':  call(f, 1200+480, 400, cached=2400),
     'read_aloud':   tts(15, era),
     'plan_day':     call('lite', 2000, 1500),
     'plan_week':    call('lite', 2500, 6000),
     'recap':        call('lite', 2000, 400),
     'wellbeing':    call('lite', 1500, 300),
     'goal':         call(f, 1500, 400),
     'insight':      call('lite', 1500, 120),
     'estimate':     call('lite', 600, 150),
    }
for name, fn in [('CURRENT', current), ('OPTIMISED', optimised)]:
    for era in ['26','27']:
        c = fn(era); print(f"{name} 20{era}: " + ", ".join(f"{k} ${v:.4f}" for k,v in c.items()))

# Revenue per credit
NET = 0.70
packs = {'100 / $1.99':(100,1.99),'500 / $7.99':(500,7.99),'1500 / $19.99':(1500,19.99),'Pro 1000/mo $9.99':(1000,9.99)}
print("\nNet revenue per credit (70%):")
for k,(n,p) in packs.items(): print(f"  {k}: gross ${p/n:.4f}  net ${p*NET/n:.4f}")

# Usage profiles per day: counts of each feature
profiles = {
 'Light':   {'coach':2,'coach_photo':0.3,'insight':1},
 'Typical': {'coach':3,'coach_photo':1,'coach_voice':0.3,'read_aloud':1,'plan_day':2*0.3,'insight':1,'recap':1/7,'wellbeing':0.3,'estimate':0.2},
 'Heavy':   {'coach':6,'coach_photo':2,'coach_voice':2,'read_aloud':8,'plan_day':2,'insight':1,'recap':1/7,'wellbeing':1,'estimate':0.3},
}
CUR = {'coach':1,'coach_photo':2,'coach_voice':2,'read_aloud':1,'plan_day':3,'plan_week':3,'recap':2,'wellbeing':1,'goal':1,'insight':0,'estimate':0}
NEW = {'coach':1,'coach_photo':2,'coach_voice':2,'read_aloud':1,'plan_day':2,'plan_week':6,'recap':1,'wellbeing':1,'goal':1,'insight':0,'estimate':0}
def month(profile, costs, credits): 
    cost = sum(costs[k]*n for k,n in profile.items())*30
    cr = sum(credits[k]*n for k,n in profile.items())*30
    return cost, cr
for name, fn, credits in [('CURRENT', current, CUR), ('OPTIMISED', optimised, NEW)]:
    for era in ['26','27']:
        c = fn(era)
        print(f"\n{name} 20{era}")
        for pn, pr in profiles.items():
            cost, cr = month(pr, c, credits)
            line = f"  {pn}: {cr:.0f} credits/mo, AI cost ${cost:.2f}/mo, ${cost/cr:.4f}/credit; 1500 lasts {1500/cr:.1f} mo;"
            for k,(n,p) in packs.items():
                net = p*NET/n
                line += f" {k.split(' ')[0]}{'' if 'Pro' not in k else ''} margin {(net-cost/cr)/net*100:.0f}%;"
            print(line)

print("\n=== RECOMMENDED (optimised engine, new credit costs, new packs) ===")
REC = {'coach':1,'coach_photo':2,'coach_voice':2,'read_aloud':1,'plan_day':1,'plan_week':4,'recap':1,'wellbeing':1,'goal':1,'insight':0,'estimate':0}
RPACKS = {'100/$1.99':(100,1.99),'500/$7.99':(500,7.99),'1500/$24.99':(1500,24.99),'Pro 600/mo $9.99':(600,9.99)}
for share, label in [(0.70,'Apple 30%'),(0.85,'Small Business 15%')]:
  for era in ['26','27']:
    c = optimised(era); print(f"-- 20{era}, {label}")
    for pn, pr in profiles.items():
        cost, cr = month(pr, c, REC)
        line = f"  {pn}: {cr:.0f} cr/mo, cost ${cost:.2f}/mo; 1500 lasts {1500/cr:.1f} mo, 100 lasts {100/cr*30:.0f} days;"
        for k,(n,p) in RPACKS.items():
            net = p*share/n; line += f" {k} {(net-cost/cr)/net*100:.0f}%;"
        print(line)
# per-feature margin at worst tier (Pro 600, 70%, 2027)
net = 9.99*0.70/600; c = optimised('27')
print(f"\nPer feature at Pro 600 for 9.99, 70 pct, 2027: net/credit {net:.4f}")
for k,v in REC.items():
    if v: print(f"  {k}: {v} cr, cost ${c[k]:.4f}, margin {(v*net-c[k])/(v*net)*100:.0f}%")
# typical subscriber/pack contribution and breakeven
cost, cr = month(profiles['Typical'], optimised('27'), REC)
pack_month = 24.99/ (1500/cr)
print(f"\nTypical buyer of 1500/$24.99: spends ${pack_month:.2f}/mo gross, ${pack_month*0.7:.2f} net, AI ${cost:.2f} -> contribution ${pack_month*0.7-cost:.2f}/mo")
print(f"Pro typical: net ${9.99*0.7:.2f}, AI ${cost:.2f} -> ${9.99*0.7-cost:.2f}/mo")
fixed = 25 + 99/12
print(f"Fixed ${fixed:.2f}/mo -> breakeven {fixed/(pack_month*0.7-cost):.0f} pack users or {fixed/(9.99*0.7-cost):.0f} Pro subs")
print(f"Signup bonus 50 credits costs ~${50*cost/cr:.2f} per new user (2027)")
