import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Generic Replacements
    content = re.sub(r'bg-black/30 backdrop-blur-2xl border border-white/\[0\.08\] rounded-3xl', r'bg-white/[0.025] backdrop-blur-xl border border-white/[0.06] rounded-2xl', content)
    
    content = re.sub(r'shadow-\[0_8px_32px_rgba\(0,0,0,0\.5\)\] relative overflow-hidden flex flex-col', r'shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex flex-col', content)
    content = re.sub(r'shadow-\[0_8px_32px_rgba\(0,0,0,0\.5\)\] flex flex-col', r'shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex flex-col', content)
    content = re.sub(r'shadow-\[0_8px_32px_rgba\(0,0,0,0\.5\)\]', r'shadow-[0_4px_24px_rgba(0,0,0,0.3)]', content)

    # Blur Orbs
    content = re.sub(r'<div className="absolute top-0 right-0 w-\d+ h-\d+ bg-[a-z]+-500/5 rounded-full blur-(?:2|3)xl pointer-events-none(?: group-hover:bg-[a-z]+-500/10 transition-colors)?"></div>\s*', r'', content)
    content = re.sub(r'<div className="absolute bottom-0 left-0 w-\d+ h-\d+ bg-[a-z]+-500/5 rounded-full blur-(?:2|3)xl pointer-events-none(?: group-hover:bg-[a-z]+-500/10 transition-colors)?"></div>\s*', r'', content)
    content = re.sub(r'<div className="absolute top-0 right-0 w-\d+ h-\d+ bg-[a-z]+-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[a-z]+-500/20 transition-colors duration-500"></div>\s*', r'', content)

    # Headers and Icons
    content = re.sub(r'bg-gradient-to-br from-[a-z]+-500/20 to-[a-z]+-500/20 rounded-3xl border border-white/\[0\.04\] shadow-lg shadow-[a-z]+-500/10', r'bg-white/[0.05] rounded-2xl border border-white/[0.06]', content)
    content = re.sub(r'text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400', r'text-3xl font-extrabold text-slate-100', content)
    
    # CTA Buttons
    content = re.sub(r'bg-gradient-to-r from-([a-z]+)-600 to-\1-500 hover:from-\1-500 hover:to-\1-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-\1-500/25 hover:shadow-\1-500/40 hover:-translate-y-0\.5', r'bg-\1-600 hover:bg-\1-500 text-white font-bold rounded-xl transition-all duration-200', content)
    content = re.sub(r'bg-gradient-to-r from-([a-z]+)-600 to-\1-500 hover:from-\1-500 hover:to-\1-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-\1-500/25 hover:shadow-\1-500/40 hover:-translate-y-0\.5', r'bg-\1-600 hover:bg-\1-500 text-white font-medium rounded-xl transition-all duration-200', content)

    # Inputs
    content = re.sub(r'bg-black/40 border border-white/\[0\.08\] rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-[a-z]+-500/50 focus:ring-2 focus:ring-[a-z]+-500/20 transition-all shadow-inner', r'bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-slate-200 font-medium focus:outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/15 transition-all', content)
    content = re.sub(r'bg-black/60 border border-white/\[0\.08\] rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-[a-z]+-500/50 focus:ring-2 focus:ring-[a-z]+-500/20 transition-all shadow-inner', r'bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-slate-200 font-medium focus:outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/15 transition-all', content)
    content = re.sub(r'bg-black/40 border border-white/\[0\.08\] rounded-xl', r'bg-white/[0.04] border border-white/[0.07] rounded-xl', content)
    content = re.sub(r'bg-black/40 border border-white/\[0\.08\]', r'bg-white/[0.04] border border-white/[0.07]', content)
    
    # Modals
    content = re.sub(r'bg-black/60 backdrop-blur-2xl border border-white/\[0\.08\] rounded-3xl', r'bg-[#0d1017]/95 backdrop-blur-2xl border border-white/[0.07] rounded-2xl', content)
    content = re.sub(r'border-b border-white/\[0\.08\] flex justify-between items-center bg-black/50', r'border-b border-white/[0.06] flex justify-between items-center', content)
    content = re.sub(r'border-t border-white/\[0\.08\] flex gap-3 bg-black/30', r'border-t border-white/[0.06] flex gap-3 bg-white/[0.01]', content)
    content = re.sub(r'bg-black/60 backdrop-blur-xl animate-in fade-in', r'bg-black/70 backdrop-blur-xl animate-in fade-in', content)
    
    # Buttons
    content = re.sub(r'bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors border border-white/\[0\.04\]', r'bg-white/[0.04] hover:bg-white/[0.07] text-slate-300 font-bold rounded-xl transition-colors border border-white/[0.06]', content)
    content = re.sub(r'p-2\.5 text-slate-400 hover:text-([a-z]+)-400 hover:bg-\1-400/10 bg-black/40 border border-white/\[0\.04\] rounded-lg transition-all shadow-sm', r'p-2.5 text-slate-500 hover:text-\1-400 hover:bg-\1-400/10 bg-white/[0.03] border border-white/[0.06] rounded-lg transition-all', content)
    content = re.sub(r'p-2\.5 text-slate-400 hover:text-([a-z]+)-400 hover:bg-\1-400/10 bg-black/60 border border-white/\[0\.08\] rounded-xl transition-all shadow-sm', r'p-2.5 text-slate-500 hover:text-\1-400 hover:bg-\1-400/10 bg-white/[0.03] border border-white/[0.06] rounded-lg transition-all', content)
    content = re.sub(r'bg-black/40 text-slate-400 hover:text-([a-z]+)-400 hover:bg-\1-400/10 border border-white/\[0\.04\] rounded-xl transition-all shadow-sm', r'bg-white/[0.03] text-slate-500 hover:text-\1-400 hover:bg-\1-400/10 border border-white/[0.06] rounded-xl transition-all', content)
    
    # Texts
    content = re.sub(r'text-slate-400 mt-1 font-medium', r'text-slate-500 mt-1 font-medium', content)
    content = re.sub(r'text-xs font-bold uppercase tracking-wider text-slate-400', r'text-xs font-bold uppercase tracking-wider text-slate-500', content)
    content = re.sub(r'text-white mb-6', r'text-slate-100 mb-6', content)
    content = re.sub(r'text-white flex items-center gap-2', r'text-slate-100 flex items-center gap-2', content)

    # Devices specific
    content = re.sub(r'bg-black/40 border border-white/\[0\.08\] rounded-3xl p-5', r'bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5', content)
    content = re.sub(r'bg-black/50 p-3 rounded-2xl border border-white/\[0\.04\]', r'bg-white/[0.02] p-3 rounded-xl border border-white/[0.05]', content)
    content = re.sub(r'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400', r'bg-emerald-500/[0.12] text-emerald-400', content)
    content = re.sub(r'bg-gradient-to-br from-rose-500/20 to-red-500/20 text-rose-400', r'bg-rose-500/[0.12] text-rose-400', content)
    content = re.sub(r'bg-black/40 rounded-3xl border border-white/\[0\.08\]', r'bg-white/[0.03] rounded-2xl border border-white/[0.05]', content)
    content = re.sub(r'border-t border-white/\[0\.08\] relative z-10', r'border-t border-white/[0.06] relative z-10', content)

    # Staff specific
    content = re.sub(r'bg-gradient-to-br from-blue-500 to-indigo-600', r'bg-white/[0.08] text-slate-300 border border-white/[0.08]', content)
    content = re.sub(r'bg-gradient-to-br from-indigo-500 to-purple-600', r'bg-white/[0.08] text-slate-300 border border-white/[0.08]', content)
    content = re.sub(r'bg-indigo-500/10 text-indigo-400/80 inline-block px-2 py-0\.5 rounded-md border border-indigo-500/10', r'bg-white/[0.05] inline-block px-2 py-0.5 rounded-md border border-white/[0.05] text-slate-400', content)
    content = re.sub(r'hover:bg-white/5 transition-colors', r'hover:bg-white/[0.04] transition-colors', content)

    # General replacements where appropriate
    content = content.replace('shadow-[0_0_15px_rgba(99,102,241,0.5)]', '')
    content = content.replace('shadow-[0_0_15px_rgba(16,185,129,0.5)]', '')
    content = content.replace('shadow-[0_0_15px_rgba(244,63,94,0.5)]', '')
    
    # Reports Header specific
    content = re.sub(r'bg-black/30 backdrop-blur-2xl border border-white/\[0\.08\] rounded-3xl p-6 sm:p-8 shadow-\[0_8px_32px_rgba\(0,0,0,0\.5\)\] relative overflow-hidden', r'bg-white/[0.025] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.3)]', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

files_to_process = [
    r"c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\calendar\page.tsx",
    r"c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\users\page.tsx",
    r"c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\reports\member-attendance\page.tsx",
    r"c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\reports\member-payroll\page.tsx",
    r"c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\reports\member-payroll\[id]\page.tsx",
    r"c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\reports\payroll-analytics\page.tsx",
    r"c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\reports\payroll-analytics\PayrollAnalyticsClient.tsx",
]
process_file(r'c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\staff\page.tsx')
process_file(r'c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\reports\page.tsx')
process_file(r'c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\payroll\monthly\page.tsx')
process_file(r'c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\payroll\staff\page.tsx')
process_file(r'c:\Users\StrawHat\MasterRepo\web_develpoment\attendencemgmt\src\app\attendance\manual\page.tsx')
