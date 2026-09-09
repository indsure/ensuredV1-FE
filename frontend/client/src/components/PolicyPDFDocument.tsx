/**
 * The downloadable audit report.
 *
 * Three things here are load-bearing and easy to undo by accident:
 *
 *  1. Fonts are the FULL Noto Sans TTF, not the `latin` woff subset. The latin
 *     subset has no U+20B9, which is why every rupee sign in the shipped PDF
 *     renders as nothing. Verified with fontTools: latin woff -> no glyph,
 *     full ttf -> glyph present. Playfair has no rupee glyph either, so no
 *     currency is ever set in the display face.
 *  2. ONE flowing <Page> instead of two pages of `wrap={false}` slabs. That is
 *     what left ~40% of the shipped document blank.
 *  3. Nothing that the fonts cannot draw. Ticks, crosses and severity marks are
 *     vector <Svg>, because no available face carries U+2713 / U+26A0 / U+23F3.
 */
import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    Svg,
    Path,
    Line,
    Image,
} from '@react-pdf/renderer';
import { ForensicAuditReport, deriveCoverView, describeRestoration } from '@shared/policy';

/* ------------------------------------------------------------------ fonts */

/** Self-hosted so a CDN outage cannot silently change the document. */
export const PDF_FONT_SOURCES = {
    sans400: '/fonts/NotoSans-Regular.ttf',
    sans600: '/fonts/NotoSans-SemiBold.ttf',
    sans700: '/fonts/NotoSans-Bold.ttf',
    serif400: '/fonts/PlayfairDisplay-Regular.woff',
    serif700: '/fonts/PlayfairDisplay-Bold.woff',
    serif400i: '/fonts/PlayfairDisplay-Italic.woff',
};

/** The wordmark, served from the same origin as the page generating the PDF. */
export const PDF_LOGO_SRC = '/logo.png';

let registered = false;
let logoSrc = PDF_LOGO_SRC;

export function registerPdfFonts(
    src: Partial<typeof PDF_FONT_SOURCES> & { logo?: string } = {},
) {
    if (src.logo) logoSrc = src.logo;
    if (registered) return;
    const f = { ...PDF_FONT_SOURCES, ...src };

    Font.register({
        family: 'Sans',
        fonts: [
            { src: f.sans400, fontWeight: 400 },
            { src: f.sans600, fontWeight: 600 },
            { src: f.sans700, fontWeight: 700 },
        ],
    });
    Font.register({
        family: 'Serif',
        fonts: [
            { src: f.serif400, fontWeight: 400 },
            { src: f.serif700, fontWeight: 700 },
            { src: f.serif400i, fontWeight: 400, fontStyle: 'italic' },
        ],
    });

    // v1 shipped with hyphenation on, which produced "associat-ed", "wait-ing",
    // "re-placements". A one-word array turns it off.
    Font.registerHyphenationCallback((word) => [word]);

    registered = true;
}

/* ------------------------------------------------------------------ palette */

const C = {
    ink: '#101828',
    inkSoft: '#3F4654',
    muted: '#8A8272',
    faint: '#B4AC9B',
    rule: '#E3DED3',
    ruleSoft: '#EFEBE2',
    paper: '#FFFFFF',
    white: '#FFFFFF',
    teal: '#0D9488',
    tealDeep: '#0B6E67',
    amber: '#B45309',
    red: '#9B2C3B',
};

const SEVERITY: Record<string, string> = {
    low: C.muted,
    medium: C.amber,
    high: C.red,
    critical: C.red,
};

/* ------------------------------------------------------------------ format */

/** Full figures, never abbreviated: the document is the record. */
const inr = (v: number | null | undefined): string =>
    typeof v === 'number' && Number.isFinite(v) ? `₹${v.toLocaleString('en-IN')}` : '—';

/** Strings out of the model often already carry their own rupee sign. */
const inrLoose = (v: number | string | null | undefined): string => {
    if (v === null || v === undefined || v === '') return '—';
    return typeof v === 'number' ? inr(v) : String(v);
};

const titleCaseKey = (k: string) =>
    k === 'opd' ? 'OPD' : k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const OTHER_COVER_LABEL: Record<string, string> = {
    super_topup: 'Super top-up',
    corporate: 'Company / corporate policy',
    ayushman: 'Ayushman Bharat (PM-JAY)',
};

/* ------------------------------------------------------------------ styles */

const s = StyleSheet.create({
    page: {
        paddingTop: 58,
        paddingBottom: 58,
        paddingHorizontal: 52,
        backgroundColor: C.paper,
        fontFamily: 'Sans',
        fontSize: 9,
        color: C.inkSoft,
        lineHeight: 1.5,
    },

    /* running furniture */
    runHead: {
        position: 'absolute',
        top: 26,
        left: 52,
        right: 52,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    runFoot: {
        position: 'absolute',
        top: 786,
        left: 52,
        right: 52,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 0.6,
        borderTopColor: C.rule,
        paddingTop: 7,
    },
    micro: { fontSize: 6.8, color: C.faint, letterSpacing: 0.2 },

    /* masthead */
    masthead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderBottomWidth: 0.6,
        borderBottomColor: C.rule,
        paddingBottom: 9,
        marginBottom: 26,
    },
    /** The wordmark is 784x599; 54pt wide holds that ratio and keeps the rule
     *  through the ascenders legible at print size. */
    wordmark: { width: 54, height: 41.3 },

    eyebrow: {
        fontSize: 6.8,
        fontWeight: 700,
        letterSpacing: 1.15,
        color: C.muted,
        textTransform: 'uppercase',
    },

    /* verdict */
    verdictRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
    verdictLabel: {
        fontSize: 7,
        fontWeight: 700,
        letterSpacing: 1.15,
        color: C.tealDeep,
        textTransform: 'uppercase',
    },
    headline: {
        fontFamily: 'Serif',
        fontSize: 24,
        lineHeight: 1.24,
        color: C.ink,
        marginBottom: 11,
    },
    deck: { fontSize: 9.5, lineHeight: 1.62, color: C.inkSoft, maxWidth: '92%' },

    /* fact strip */
    facts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderTopWidth: 0.6,
        borderTopColor: C.rule,
        marginTop: 24,
    },
    fact: {
        width: '33.33%',
        borderBottomWidth: 0.6,
        borderBottomColor: C.ruleSoft,
        paddingVertical: 10,
        paddingRight: 14,
    },
    factLabel: {
        fontSize: 6.4,
        fontWeight: 700,
        letterSpacing: 1,
        color: C.faint,
        textTransform: 'uppercase',
        marginBottom: 3,
    },
    factValue: { fontSize: 10, fontWeight: 600, color: C.ink, lineHeight: 1.3 },

    /* section heads */
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        borderBottomWidth: 0.6,
        borderBottomColor: C.rule,
        paddingBottom: 6,
        marginTop: 21,
        marginBottom: 12,
    },
    sectionTitle: { fontFamily: 'Serif', fontSize: 14, color: C.ink },
    sectionNote: { fontSize: 6.8, color: C.faint, letterSpacing: 0.6, textTransform: 'uppercase' },

    /* score */
    scoreRow: { flexDirection: 'row', marginTop: 4 },
    scoreLeft: { width: 158, paddingRight: 22 },
    scoreNum: { fontFamily: 'Serif', fontSize: 58, color: C.ink, lineHeight: 1.32 },
    scoreOf: { fontSize: 7, fontWeight: 700, color: C.faint, marginTop: 0, marginBottom: 11, letterSpacing: 1, textTransform: 'uppercase' },
    scoreBucket: { fontSize: 9.5, fontWeight: 700, color: C.tealDeep, marginBottom: 5 },
    scoreMeta: { fontSize: 7.6, color: C.muted, lineHeight: 1.55 },
    scoreRight: { flex: 1, borderLeftWidth: 0.6, borderLeftColor: C.rule, paddingLeft: 22 },

    meterRow: { marginBottom: 11 },
    meterTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    meterLabel: { fontSize: 8.2, fontWeight: 600, color: C.inkSoft },
    meterVal: { fontSize: 8.2, fontWeight: 700 },
    meterTrack: { height: 2.5, backgroundColor: C.ruleSoft },
    meterFill: { height: 2.5 },

    /* deduction ledger */
    dedRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    dedDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4.5, marginRight: 9 },
    dedText: { flex: 1, fontSize: 8.6, color: C.inkSoft, lineHeight: 1.5 },
    dedPts: { fontSize: 8.2, fontWeight: 700, color: C.ink, marginLeft: 10 },

    /* two-column */
    cols: { flexDirection: 'row', gap: 26 },
    col: { flex: 1 },
    colHead: {
        fontSize: 6.8,
        fontWeight: 700,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        marginBottom: 11,
    },

    card: { borderLeftWidth: 1.6, paddingLeft: 11, marginBottom: 13 },
    cardTitle: { fontSize: 9.5, fontWeight: 700, color: C.ink, marginBottom: 3 },
    cardBody: { fontSize: 8.4, color: C.inkSoft, lineHeight: 1.55 },
    cardFig: { fontSize: 8.4, fontWeight: 600, marginTop: 4 },

    /* simulation table */
    simHead: {
        flexDirection: 'row',
        borderBottomWidth: 0.6,
        borderBottomColor: C.rule,
        paddingBottom: 5,
    },
    simRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.6,
        borderBottomColor: C.ruleSoft,
        paddingVertical: 10,
    },
    simScenario: { flex: 1, paddingRight: 16 },
    simNum: { width: 74, textAlign: 'right' },
    simColLabel: {
        fontSize: 6.2,
        fontWeight: 700,
        letterSpacing: 0.9,
        color: C.faint,
        textTransform: 'uppercase',
    },
    simTitle: { fontSize: 9.2, fontWeight: 600, color: C.ink, marginBottom: 3 },
    simWhy: { fontSize: 7.6, color: C.muted, lineHeight: 1.5 },
    simFig: { fontSize: 9.6, fontWeight: 600, color: C.ink },

    /* definition list */
    defRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.6,
        borderBottomColor: C.ruleSoft,
        paddingVertical: 8,
    },
    defKey: { width: 128, fontSize: 8, color: C.muted, paddingRight: 12 },
    defVal: { fontSize: 8.8, fontWeight: 600, color: C.ink },

    /* waiting periods */
    wpRow: { marginBottom: 14 },
    wpTop: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 9 },
    wpTitle: { flex: 1, fontSize: 9.2, fontWeight: 600, color: C.ink, paddingRight: 10 },
    wpStatus: { fontSize: 8, fontWeight: 700, textAlign: 'right' },
    wpTrack: { height: 2.5, backgroundColor: C.ruleSoft },
    wpFill: { height: 2.5, backgroundColor: C.amber },
    wpNote: { fontSize: 7.5, color: C.muted, marginTop: 4, lineHeight: 1.5 },

    /* checklist */
    checkRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6.5 },
    checkMark: { width: 14, marginTop: 1.5 },
    checkTitle: { fontSize: 8.8, fontWeight: 600, color: C.ink },
    checkNote: { fontSize: 7.5, color: C.muted, lineHeight: 1.5, marginTop: 2 },

    /* recommendations */
    recRow: { flexDirection: 'row', marginBottom: 13 },
    recNum: { fontFamily: 'Serif', fontSize: 19, color: C.faint, width: 30, marginTop: -3 },
    recTitle: { fontSize: 10, fontWeight: 700, color: C.ink, marginBottom: 3 },
    recBody: { fontSize: 8.6, color: C.inkSoft, lineHeight: 1.55 },
    recRisk: { fontSize: 8.2, fontWeight: 600, color: C.red, marginTop: 4 },

    /* closing */
    quote: {
        fontFamily: 'Serif',
        fontStyle: 'italic',
        fontSize: 14.5,
        color: C.ink,
        textAlign: 'center',
        marginTop: 28,
        marginBottom: 8,
        lineHeight: 1.45,
    },
    quoteRule: { alignSelf: 'center', width: 42, height: 0.8, backgroundColor: C.teal, marginTop: 16 },
    provenance: { fontSize: 7.2, color: C.faint, lineHeight: 1.6, marginTop: 22 },
});

/* ------------------------------------------------------------------ atoms */

const Tick = ({ colour = C.teal }: { colour?: string }) => (
    <Svg width={9} height={9} viewBox="0 0 12 12">
        <Path d="M2 6.4 L4.7 9.1 L10 3.1" stroke={colour} strokeWidth={1.7} fill="none" />
    </Svg>
);

const Cross = ({ colour = C.faint }: { colour?: string }) => (
    <Svg width={9} height={9} viewBox="0 0 12 12">
        <Line x1={3} y1={3} x2={9} y2={9} stroke={colour} strokeWidth={1.5} />
        <Line x1={9} y1={3} x2={3} y2={9} stroke={colour} strokeWidth={1.5} />
    </Svg>
);

/**
 * Playfair carries no U+20B9. Any display-face string that contains a rupee sign
 * is split so the symbol alone falls back to the sans, rather than dropping out
 * of the document the way it did in v1.
 */
const Display: React.FC<{ style?: any; children?: string | null }> = ({ style, children }) => {
    const text = (children ?? '').replace(/\s+/g, ' ').trim();
    if (!text.includes('₹')) return <Text style={style}>{text}</Text>;
    const nodes: React.ReactNode[] = [];
    text.split('₹').forEach((part, i) => {
        if (i > 0) nodes.push(<Text key={`r${i}`} style={{ fontFamily: 'Sans' }}>{'₹'}</Text>);
        if (part) nodes.push(part);
    });
    return <Text style={style}>{nodes}</Text>;
};

const SectionHead = ({ title, note }: { title: string; note?: string }) => (
    <View style={s.sectionHead} minPresenceAhead={130}>
        <Display style={s.sectionTitle}>{title}</Display>
        {note ? <Text style={s.sectionNote}>{note}</Text> : null}
    </View>
);

/* ------------------------------------------------------------------ props */

export interface PdfMeta {
    insurer?: string | null;
    policyName?: string | null;
    policyNumber?: string | null;
    policyholderName?: string | null;
    sourceFilename?: string | null;
    generatedAt?: string | null;
}

interface Props {
    data: ForensicAuditReport;
    meta?: PdfMeta;
}

/* ------------------------------------------------------------------ doc */

export const PolicyPDFDocument: React.FC<Props> = ({ data, meta = {} }) => {
    const cover = deriveCoverView(data);
    const restoration = describeRestoration(data);

    // Countdowns are anchored to the date the audit was run, not to "now", so a
    // report reprinted months later still describes the state it was written in.
    const today = data.policy_timeline?.analysis_date
        ? new Date(data.policy_timeline.analysis_date)
        : new Date();

    const generated = meta.generatedAt ? new Date(meta.generatedAt) : new Date();
    const generatedLabel = generated.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const insured = data.identity?.insured_names?.join(', ') || meta.policyholderName || '—';
    const ageDays = data.policy_timeline?.policy_age_days ?? 0;
    const ageLabel =
        ageDays >= 365
            ? `${Math.floor(ageDays / 365)} yr ${ageDays % 365} days`
            : `${ageDays} days`;

    const bd = data.audit_score?.breakdown ?? ({} as Record<string, number>);
    const meters = [
        { key: 'claim_rejection_risk', label: 'Claim rejection risk', max: 30 },
        { key: 'oop_exposure', label: 'Out-of-pocket exposure', max: 30 },
        { key: 'coverage_quality_gap', label: 'Coverage quality gap', max: 20 },
        { key: 'net_cover_penalty', label: 'Net cover penalty', max: 20 },
    ].map((m) => {
        const v = (bd as any)[m.key] ?? 0;
        const colour = v === 0 ? C.teal : v / m.max >= 0.5 ? C.red : C.amber;
        return { ...m, value: v, colour };
    });

    const works = data.benefit_evaluation?.what_actually_works ?? [];
    const fails = data.benefit_evaluation?.where_policy_fails ?? [];
    const sims = data.claim_simulations ?? [];
    const deductions = data.audit_score?.deductions ?? [];
    const riders = (data.coverage_structure?.riders ?? []).filter((r: any) => r?.name);
    const supp = (data.supplementary_coverage ?? {}) as Record<string, any>;
    const risk = data.claim_risk_analysis ?? ({} as any);
    const wpa = data.waiting_period_analysis ?? ({} as any);

    const recs = [
        ...(data.recommendations?.critical_actions ?? []).map((r: any) => ({ ...r, level: 'critical' })),
        ...(data.recommendations?.medium_priority ?? []).map((r: any) => ({ ...r, level: 'medium' })),
        ...(data.recommendations?.low_priority ?? []).map((r: any) => ({ ...r, level: 'low' })),
    ];
    const port = data.recommendations?.should_port_to_better_policy;

    /* one waiting-period row; title and status can no longer collide */
    const wpRow = (title: string, wp: any, durationDays: number, key: string) => {
        if (!wp || wp.relevant === false) return null;

        const stated = wp.duration_months != null || wp.duration_days != null;
        if (!stated) {
            return (
                <View style={s.wpRow} key={key} wrap={false}>
                    <View style={s.wpTop}>
                        <Text style={s.wpTitle}>{title}</Text>
                        <Text style={[s.wpStatus, { color: C.amber }]}>Not stated</Text>
                    </View>
                    <Text style={s.wpNote}>Duration is absent from the policy document. Confirm with the insurer.</Text>
                </View>
            );
        }

        const served = wp.is_active_today === false || wp.months_remaining === 0 || ageDays >= durationDays;
        const pct = served ? 100 : Math.min(100, Math.max(0, (ageDays / durationDays) * 100));

        // `months_remaining` is often absent even when `end_date` is present, so the
        // countdown is measured from the report's own analysis date rather than
        // inferred from a months-to-days conversion, which produced fractional days.
        let remaining = 'Served';
        if (!served) {
            if (wp.months_remaining != null) {
                remaining = `${wp.months_remaining} ${wp.months_remaining === 1 ? 'month' : 'months'} left`;
            } else if (wp.end_date) {
                const days = Math.max(0, Math.ceil((new Date(wp.end_date).getTime() - today.getTime()) / 86400000));
                remaining =
                    days > 60
                        ? `${Math.round(days / 30.44)} months left`
                        : `${days} ${days === 1 ? 'day' : 'days'} left`;
            } else {
                const days = Math.max(0, Math.round(durationDays - ageDays));
                remaining = `${days} ${days === 1 ? 'day' : 'days'} left`;
            }
        }

        return (
            <View style={s.wpRow} key={key} wrap={false}>
                <View style={s.wpTop}>
                    <Text style={s.wpTitle}>
                        {title}
                        {wp.stated === false ? ' (estimated)' : ''}
                    </Text>
                    <Text style={[s.wpStatus, { color: served ? C.tealDeep : C.amber }]}>
                        {served ? 'Served' : remaining}
                    </Text>
                </View>
                <View style={s.wpTrack}>
                    <View style={[s.wpFill, { width: `${pct}%`, backgroundColor: served ? C.teal : C.amber }]} />
                </View>
                {wp.risk_commentary ? <Text style={s.wpNote}>{wp.risk_commentary}</Text> : null}
            </View>
        );
    };

    return (
        <Document
            title={`IndSure policy audit — ${insured}`}
            author="IndSure"
            subject={meta.policyName ?? 'Forensic policy audit'}
        >
            <Page size="A4" style={s.page}>
                {/* running header, from page 2 on */}
                <View
                    style={s.runHead}
                    fixed
                    render={({ pageNumber }) =>
                        pageNumber > 1 ? (
                            <>
                                <Text style={s.micro}>INDSURE FORENSIC POLICY AUDIT</Text>
                                <Text style={s.micro}>{insured.toUpperCase()}</Text>
                            </>
                        ) : null
                    }
                />

                <View
                    style={s.runFoot}
                    fixed
                    render={(props) => {
                        // @react-pdf v4 types the View render payload without
                        // `totalPages`, though the renderer does supply it here.
                        const { pageNumber, totalPages } = props as unknown as {
                            pageNumber: number;
                            totalPages: number;
                        };
                        return (
                            <>
                                <Text style={s.micro}>
                                    All scoring is computed from your policy document. No manual overrides.
                                </Text>
                                <Text style={s.micro}>
                                    {pageNumber} / {totalPages}
                                </Text>
                            </>
                        );
                    }}
                />

                {/* ---------------------------------------------- masthead */}
                <View style={s.masthead}>
                    <Image style={s.wordmark} src={logoSrc} />
                    <Text style={s.eyebrow}>Forensic policy audit · {generatedLabel}</Text>
                </View>

                {/* ---------------------------------------------- verdict */}
                <View style={s.verdictRow}>
                    <Svg width={7} height={7} viewBox="0 0 8 8" style={{ marginRight: 6 }}>
                        <Path d="M4 0 L8 4 L4 8 L0 4 Z" fill={C.teal} />
                    </Svg>
                    <Text style={s.verdictLabel}>Verdict · {data.final_verdict?.label ?? 'Reviewed'}</Text>
                </View>

                <Display style={s.headline}>{data.final_verdict?.summary}</Display>
                {data.final_verdict?.will_this_policy_protect_in_real_claim ? (
                    <Text style={s.deck}>{data.final_verdict.will_this_policy_protect_in_real_claim}</Text>
                ) : null}

                {/* ---------------------------------------------- facts */}
                <View style={s.facts}>
                    {([
                        ['Insured', insured],
                        ['Insurer', meta.insurer],
                        ['Plan', meta.policyName],
                        ['Policy number', meta.policyNumber],
                        ['Effective cover', cover.effectiveCover ? inr(cover.effectiveCover) : null],
                        ['Policy age', ageLabel],
                        ['Data quality', data.data_quality?.overall ? titleCaseKey(String(data.data_quality.overall)) : null],
                    ] as [string, string | null | undefined][])
                        // A cell the document cannot source is left out entirely rather
                        // than printed as a dash: an absent row reads as absent data.
                        .filter(([, v]) => v != null && String(v).trim() !== '' && v !== '—')
                        .map(([k, v]) => (
                        <View style={s.fact} key={k as string}>
                            <Text style={s.factLabel}>{k}</Text>
                            <Text style={s.factValue}>{String(v).replace(/\s+/g, ' ').trim()}</Text>
                        </View>
                    ))}
                </View>

                {/* ---------------------------------------------- score */}
                <SectionHead title="Audit score" note="0 – 100" />
                <View style={s.scoreRow}>
                    <View style={s.scoreLeft}>
                        <Text style={s.scoreNum}>{data.audit_score?.score}</Text>
                        <Text style={s.scoreOf}>out of 100</Text>
                        {data.audit_score?.bucket_label ? (
                            <Text style={s.scoreBucket}>{data.audit_score.bucket_label}</Text>
                        ) : null}
                        <Text style={s.scoreMeta}>
                            {typeof cover.ncar === 'number' ? `NCAR ${cover.ncar.toFixed(2)}x\n` : ''}
                            {typeof data.audit_score?.rct === 'number'
                                ? `Recommended cover ${inr(data.audit_score.rct)}`
                                : ''}
                        </Text>
                    </View>

                    <View style={s.scoreRight}>
                        {meters.map((m) => (
                            <View style={s.meterRow} key={m.key}>
                                <View style={s.meterTop}>
                                    <Text style={s.meterLabel}>{m.label}</Text>
                                    <Text style={[s.meterVal, { color: m.colour }]}>
                                        {m.value} / {m.max}
                                    </Text>
                                </View>
                                <View style={s.meterTrack}>
                                    <View
                                        style={[
                                            s.meterFill,
                                            {
                                                width: `${Math.max(1.5, (m.value / m.max) * 100)}%`,
                                                backgroundColor: m.colour,
                                            },
                                        ]}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {data.audit_score?.interpretation ? (
                    <Text style={[s.deck, { marginTop: 12 }]}>{data.audit_score.interpretation}</Text>
                ) : null}

                <View wrap={false}>
                    <Text style={s.quote}>“The policy is fixed. Your awareness of it isn’t.”</Text>
                    <View style={s.quoteRule} />
                </View>

                {/* ---------------------------------------------- ledger */}
                {deductions.length > 0 && (
                    <>
                        <SectionHead title="Where the points went" note={`${deductions.length} deductions`} />
                        {deductions.map((d: any, i: number) => (
                            <View style={s.dedRow} key={i} wrap={false}>
                                <View style={[s.dedDot, { backgroundColor: SEVERITY[d.severity] ?? C.muted }]} />
                                <Text style={s.dedText}>{d.reason}</Text>
                                <Text style={s.dedPts}>−{d.points}</Text>
                            </View>
                        ))}
                    </>
                )}

                {/* ---------------------------------------------- coverage */}
                <SectionHead title="Coverage overview" />
                <View style={s.cols}>
                    <View style={s.col}>
                        <Text style={[s.colHead, { color: C.tealDeep }]}>What actually works</Text>
                        {works.map((w: any, i: number) => (
                            <View style={[s.card, { borderLeftColor: C.teal }]} key={i} wrap={false}>
                                <Text style={s.cardTitle}>{w.benefit}</Text>
                                <Text style={s.cardBody}>{w.why_it_matters_in_claim}</Text>
                                {w.quantified_value ? (
                                    <Text style={[s.cardFig, { color: C.tealDeep }]}>{w.quantified_value}</Text>
                                ) : null}
                            </View>
                        ))}
                    </View>
                    <View style={s.col}>
                        <Text style={[s.colHead, { color: C.amber }]}>Where it may cost you</Text>
                        {fails.map((f: any, i: number) => (
                            <View style={[s.card, { borderLeftColor: C.amber }]} key={i} wrap={false}>
                                <Text style={s.cardTitle}>{f.issue}</Text>
                                <Text style={s.cardBody}>{f.real_world_claim_impact}</Text>
                                {f.quantified_oop_risk ? (
                                    <Text style={[s.cardFig, { color: C.red }]}>{f.quantified_oop_risk}</Text>
                                ) : null}
                            </View>
                        ))}
                    </View>
                </View>

                {/* ---------------------------------------------- simulations */}
                {sims.length > 0 && (
                    <>
                        <SectionHead title="If you claimed today" note="Modelled scenarios" />
                        <View style={s.simHead}>
                            <View style={s.simScenario}>
                                <Text style={s.simColLabel}>Scenario</Text>
                            </View>
                            <View style={s.simNum}>
                                <Text style={s.simColLabel}>Total bill</Text>
                            </View>
                            <View style={s.simNum}>
                                <Text style={s.simColLabel}>Insurer pays</Text>
                            </View>
                            <View style={s.simNum}>
                                <Text style={s.simColLabel}>You pay</Text>
                            </View>
                        </View>
                        {sims.map((sim: any, i: number) => (
                            <View style={s.simRow} key={i} wrap={false}>
                                <View style={s.simScenario}>
                                    <Text style={s.simTitle}>{sim.scenario}</Text>
                                    {sim.explanation ? <Text style={s.simWhy}>{sim.explanation}</Text> : null}
                                </View>
                                <View style={s.simNum}>
                                    <Text style={s.simFig}>{inrLoose(sim.total_bill)}</Text>
                                </View>
                                <View style={s.simNum}>
                                    <Text style={[s.simFig, { color: sim.insurer_pays ? C.tealDeep : C.muted }]}>
                                        {inrLoose(sim.insurer_pays)}
                                    </Text>
                                </View>
                                <View style={s.simNum}>
                                    <Text style={[s.simFig, { color: sim.patient_oop ? C.red : C.tealDeep }]}>
                                        {inrLoose(sim.patient_oop)}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {/* ---------------------------------------------- limits */}
                <SectionHead title="Limits and deductions" />
                {[
                    ['Room rent', risk.room_rent?.limit_value ?? risk.room_rent?.limit_type ?? '—', risk.room_rent?.explanation],
                    [
                        'Co-payment',
                        risk.co_payment?.exists ? `${risk.co_payment.percentage}%` : 'None',
                        risk.co_payment?.exists ? risk.co_payment?.conditions : 'No automatic deduction on a claim.',
                    ],
                    [
                        'Sub-limits',
                        risk.sub_limits?.exists ? 'Present' : 'None',
                        risk.sub_limits?.remarks,
                    ],
                    ['Deductible', inrLoose(risk.deductibles?.base_deductible), risk.deductibles?.per_claim_impact],
                    [
                        'Restoration',
                        data.coverage_structure?.restoration?.exists ? (data.coverage_structure.restoration.restore_amount ?? 'Yes') : 'None',
                        restoration ?? data.coverage_structure?.restoration?.remarks,
                    ],
                    [
                        'No-claim bonus',
                        data.coverage_structure?.no_claim_bonus?.exists
                            ? `${data.coverage_structure.no_claim_bonus.rate_per_year}% per year`
                            : 'None',
                        data.coverage_structure?.no_claim_bonus?.remarks,
                    ],
                ].map(([k, v, note]: any, i: number) => (
                    <View style={s.defRow} key={i} wrap={false}>
                        <Text style={s.defKey}>{k}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={s.defVal}>{v}</Text>
                            {note ? <Text style={[s.simWhy, { marginTop: 2 }]}>{note}</Text> : null}
                        </View>
                    </View>
                ))}

                {/* ---------------------------------------------- riders */}
                {riders.length > 0 && (
                    <>
                        <SectionHead title="Riders on this policy" note={`${riders.length} attached`} />
                        {riders.map((r: any, i: number) => (
                            <View style={s.checkRow} key={i} wrap={false}>
                                <View style={s.checkMark}>
                                    <Tick />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.checkTitle}>{r.name}</Text>
                                    {r.remarks ? <Text style={s.checkNote}>{r.remarks}</Text> : null}
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {/* ---------------------------------------------- waiting */}
                <SectionHead title="Waiting periods" note={data.waiting_period_analysis?.policy_fully_active ? 'All served' : 'Some still active'} />
                {wpRow('Initial waiting period', wpa.initial_waiting_period, wpa.initial_waiting_period?.duration_days ?? 30, 'iwp')}
                {wpRow('Pre-existing diseases', wpa.pre_existing_disease, (wpa.pre_existing_disease?.duration_months ?? 0) * 30.44, 'ped')}
                {wpRow('Specific diseases', wpa.specific_diseases, (wpa.specific_diseases?.duration_months ?? 0) * 30.44, 'spd')}
                {wpRow('Maternity', wpa.maternity, (wpa.maternity?.duration_months ?? 0) * 30.44, 'mat')}

                {(wpa.specific_diseases?.diseases_covered?.length ?? 0) > 0 && (
                    <View wrap={false} style={{ marginTop: 2 }}>
                        <Text style={s.factLabel}>Excluded until the specific-disease period ends</Text>
                        <Text style={[s.simWhy, { marginTop: 3 }]}>
                            {wpa.specific_diseases.diseases_covered.join(' · ')}
                        </Text>
                    </View>
                )}

                {/* ---------------------------------------------- supplementary */}
                <SectionHead title="Supplementary coverage" />
                <View style={s.cols}>
                    {[0, 1].map((half) => (
                        <View style={s.col} key={half}>
                            {Object.entries(supp)
                                .filter((_, i) => i % 2 === half)
                                .map(([k, v]: [string, any]) => (
                                    <View style={s.checkRow} key={k} wrap={false}>
                                        <View style={s.checkMark}>{v?.covered ? <Tick /> : <Cross />}</View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[s.checkTitle, { color: v?.covered ? C.ink : C.muted }]}>
                                                {titleCaseKey(k)}
                                            </Text>
                                            {v?.remarks ? <Text style={s.checkNote}>{v.remarks}</Text> : null}
                                        </View>
                                    </View>
                                ))}
                        </View>
                    ))}
                </View>

                {/* ---------------------------------------------- other cover */}
                {(data.other_cover?.length ?? 0) > 0 && (
                    <>
                        <SectionHead title="Other cover held" />
                        {data.other_cover!.map((o: any, i: number) => (
                            <View style={s.defRow} key={i} wrap={false}>
                                <Text style={s.defKey}>{OTHER_COVER_LABEL[o.kind] ?? titleCaseKey(String(o.kind ?? ''))}</Text>
                                <Text style={s.defVal}>{inrLoose(o.sum_insured)}</Text>
                            </View>
                        ))}
                    </>
                )}

                {/* ---------------------------------------------- recommendations */}
                {recs.length > 0 && (
                    <>
                        <SectionHead title="What to do next" note={`${recs.length} actions`} />
                        {recs.map((r: any, i: number) => (
                            <View style={s.recRow} key={i} wrap={false}>
                                <Text style={s.recNum}>{String(i + 1).padStart(2, '0')}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.recTitle}>{r.action}</Text>
                                    <Text style={s.recBody}>{r.reason}</Text>
                                    {r.oop_risk_if_ignored ? (
                                        <Text style={s.recRisk}>If ignored: {r.oop_risk_if_ignored}</Text>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {port?.recommendation ? (
                    <View
                        style={{ borderLeftWidth: 1.6, borderLeftColor: C.teal, paddingLeft: 11, marginTop: 4 }}
                        wrap={false}
                    >
                        <Text style={s.cardTitle}>
                            {port.recommendation === 'no' ? 'Stay with this policy' : 'Consider porting'}
                        </Text>
                        <Text style={s.cardBody}>{port.reason}</Text>
                    </View>
                ) : null}

                {/* ---------------------------------------------- confidence */}
                <SectionHead
                    title="How far to trust this"
                    note={`Data quality · ${String(data.data_quality?.overall ?? 'unknown')}`}
                />
                <View style={s.cols}>
                    <View style={s.col}>
                        {[
                            ['Wording source', data.data_quality?.wording_source],
                            ['Document quality', data.data_quality?.policy_document_quality],
                            ['Timeline confidence', data.policy_timeline?.confidence],
                            ['Structure confidence', data.coverage_structure?.confidence],
                        ]
                            .filter(([, v]) => v)
                            .map(([k, v]: any) => (
                                <View style={s.defRow} key={k} wrap={false}>
                                    <Text style={s.defKey}>{k}</Text>
                                    <Text style={s.defVal}>{titleCaseKey(String(v))}</Text>
                                </View>
                            ))}
                    </View>
                    <View style={s.col}>
                        {(data.confidence_notes ?? []).map((n: any, i: number) => (
                            <View style={s.dedRow} key={i} wrap={false}>
                                <View style={[s.dedDot, { backgroundColor: C.faint }]} />
                                <Text style={s.dedText}>{typeof n === 'string' ? n : n?.note ?? ''}</Text>
                            </View>
                        ))}
                        {(data.data_quality?.missing_critical_fields ?? []).length === 0 &&
                        (data.data_quality?.ambiguous_clauses ?? []).length === 0 ? (
                            <View style={s.checkRow} wrap={false}>
                                <View style={s.checkMark}>
                                    <Tick />
                                </View>
                                <Text style={s.checkTitle}>No critical fields missing from the document</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {/* The colophon belongs with the confidence section, not on its own
                    page: keeping them apart is what left v1 with near-empty sheets. */}
                <Text style={s.provenance} wrap={false}>
                    Prepared by IndSure on {generatedLabel}
                    {meta.sourceFilename ? ` from ${meta.sourceFilename}` : ''}
                    {meta.insurer ? `, issued by ${meta.insurer}` : ''}.
                    {'\n'}
                    Every figure above is read from the policy document you supplied. Where the document is
                    silent, this report says so rather than assuming. It is an analysis, not the contract:
                    the policy wording prevails.
                </Text>

            </Page>
        </Document>
    );
};

export default PolicyPDFDocument;
