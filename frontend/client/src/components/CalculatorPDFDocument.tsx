/**
 * The downloadable cover calculation.
 *
 * Built to the same rules as PolicyPDFDocument, and for the same reasons:
 *
 *  1. Fonts come from `registerPdfFonts()` there. They are the FULL Noto Sans
 *     TTF, not the latin woff subset, because the subset has no U+20B9 and
 *     every rupee sign silently vanishes without it. Playfair has no rupee
 *     glyph at all, so any display string carrying one goes through <Display>.
 *  2. ONE flowing <Page>. Slabs of `wrap={false}` are what left the first
 *     version of the audit document 40% blank.
 *  3. Nothing the fonts cannot draw. No ticks, no arrows, no box-drawing.
 *
 * The palette and <Display> are imported rather than copied so the two
 * documents cannot drift apart.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Svg, Path, Image } from '@react-pdf/renderer';
import { C, Display, getPdfLogoSrc } from './PolicyPDFDocument';
import type { EngineResult, UserInputs } from '@/lib/health-engine-logic';

/* ------------------------------------------------------------------ format */

/** Full figures, never abbreviated: the document is the record. */
const inr = (v: number | null | undefined): string =>
    typeof v === 'number' && Number.isFinite(v) ? `₹${Math.round(v).toLocaleString('en-IN')}` : '—';

/** Headline sums read better in lakhs and crore, the way people say them. */
const lakhs = (v: number | null | undefined): string => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    if (v >= 10000000) {
        const cr = v / 10000000;
        return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} Cr`;
    }
    const l = Math.round((v / 100000) * 2) / 2;
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)} Lakhs`;
};

const range = (min: number, max: number) => `${inr(min)} – ${inr(max)}`;

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

    masthead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderBottomWidth: 0.6,
        borderBottomColor: C.rule,
        paddingBottom: 9,
        marginBottom: 26,
    },
    wordmark: { width: 54, height: 41.3 },
    eyebrow: {
        fontSize: 6.8,
        fontWeight: 700,
        letterSpacing: 1.15,
        color: C.muted,
        textTransform: 'uppercase',
    },

    /* hero */
    kickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
    kicker: { fontSize: 7, fontWeight: 700, letterSpacing: 1.15, color: C.tealDeep, textTransform: 'uppercase' },
    headline: { fontFamily: 'Serif', fontSize: 30, color: C.ink, lineHeight: 1.25 },
    deck: { fontSize: 10, color: C.inkSoft, marginTop: 7, lineHeight: 1.55 },

    /* facts */
    facts: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 22, marginBottom: 4 },
    fact: { width: '33.33%', paddingRight: 14, marginBottom: 13 },
    factLabel: { fontSize: 6.6, fontWeight: 700, letterSpacing: 0.9, color: C.faint, textTransform: 'uppercase', marginBottom: 2 },
    factValue: { fontSize: 9.2, color: C.ink, fontWeight: 600 },

    sectionHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        borderBottomWidth: 0.6,
        borderBottomColor: C.rule,
        paddingBottom: 5,
        marginTop: 26,
        marginBottom: 13,
    },
    sectionTitle: { fontFamily: 'Serif', fontSize: 14, color: C.ink },
    sectionNote: { fontSize: 6.8, color: C.faint, letterSpacing: 0.6, textTransform: 'uppercase' },

    /* the two options */
    optRow: { flexDirection: 'row' },
    // Values are right-aligned, so without this they sit on the divider rule.
    optCell: { flex: 1, paddingRight: 18 },
    optCellSplit: { flex: 1, borderLeftWidth: 0.6, borderLeftColor: C.rule, paddingLeft: 18 },
    optName: { fontSize: 7, fontWeight: 700, letterSpacing: 1, color: C.muted, textTransform: 'uppercase' },
    // Without an explicit lineHeight the Playfair box measures shorter than the
    // glyphs it draws, and the sub-line lands on top of the figure.
    optHeadline: { fontFamily: 'Serif', fontSize: 17, lineHeight: 1.35, color: C.ink, marginTop: 5, marginBottom: 7 },
    optSub: { fontSize: 8.4, color: C.muted, marginBottom: 9 },
    optLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: C.ruleSoft },
    optKey: { fontSize: 8.4, color: C.muted },
    optVal: { fontSize: 8.4, color: C.ink, fontWeight: 600 },
    optPremium: { marginTop: 9 },
    optPremiumVal: { fontSize: 11.5, color: C.ink, fontWeight: 700 },
    saveTag: { marginTop: 9, fontSize: 8.4, color: C.tealDeep, fontWeight: 700 },

    /* build-up ledger */
    buildRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.ruleSoft },
    buildKey: { fontSize: 9, color: C.inkSoft, flex: 1, paddingRight: 16 },
    buildVal: { fontSize: 9, color: C.ink, fontWeight: 600 },
    buildTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 2, borderTopWidth: 1, borderTopColor: C.ink },
    buildTotalKey: { fontSize: 9.5, color: C.ink, fontWeight: 700 },
    buildTotalVal: { fontSize: 12, color: C.ink, fontWeight: 700 },
    capNote: { fontSize: 8.2, color: C.amber, marginTop: 8, lineHeight: 1.5 },

    /* lists */
    liRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 7 },
    liDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.faint, marginTop: 5, marginRight: 9 },
    liText: { flex: 1, fontSize: 8.8, color: C.inkSoft, lineHeight: 1.55 },

    /* riders */
    rider: { marginBottom: 10 },
    riderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    riderName: { fontSize: 9.4, color: C.ink, fontWeight: 600, flex: 1, paddingRight: 12 },
    riderPriority: { fontSize: 6.6, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' },
    riderReason: { fontSize: 8.6, color: C.muted, marginTop: 2, lineHeight: 1.5 },

    /* projection */
    projHead: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: C.rule, paddingBottom: 4, marginBottom: 3 },
    projRow: { flexDirection: 'row', paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: C.ruleSoft },
    projCellHead: { fontSize: 6.6, fontWeight: 700, letterSpacing: 0.9, color: C.faint, textTransform: 'uppercase' },
    projCell: { fontSize: 8.6, color: C.inkSoft },

    /* close */
    disclaimer: {
        marginTop: 26,
        borderTopWidth: 0.6,
        borderTopColor: C.rule,
        paddingTop: 10,
        fontSize: 7.4,
        color: C.muted,
        lineHeight: 1.6,
    },
});

const PRIORITY_COLOUR: Record<string, string> = {
    High: C.red,
    Medium: C.amber,
    Optional: C.muted,
};

const SectionHead = ({ title, note }: { title: string; note?: string }) => (
    <View style={s.sectionHead} minPresenceAhead={95}>
        <Display style={s.sectionTitle}>{title}</Display>
        {note ? <Text style={s.sectionNote}>{note}</Text> : null}
    </View>
);

const Bullet = ({ children }: { children: string }) => (
    <View style={s.liRow}>
        <View style={s.liDot} />
        <Text style={s.liText}>{children}</Text>
    </View>
);

/* ------------------------------------------------------------------ props */

export interface CalculatorPdfMeta {
    /** Shown on the masthead. Defaults to today. */
    generatedAt?: string | null;
    /** Present when the report was saved and has a share URL. */
    reportId?: string | null;
}

interface Props {
    result: EngineResult;
    inputs: UserInputs;
    meta?: CalculatorPdfMeta;
}

/* ------------------------------------------------------------------ doc */

export const CalculatorPDFDocument: React.FC<Props> = ({ result, inputs, meta = {} }) => {
    const generatedLabel =
        meta.generatedAt ??
        new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    const plans = result.plans;
    const total = plans?.optimal.totalSI ?? result.coverageBreakdown?.finalOptimal ?? 0;
    const saving = plans?.efficientSavingPct ?? 0;
    const bd = result.coverageBreakdown;
    // Older stored reports carry only the three legacy figures, which never
    // summed to the total printed beneath them. Print what they actually hold.
    const ledger =
        bd?.ledger ??
        [
            { label: "Worst realistic hospitalisation, at today's prices", amount: bd?.worstCase ?? 0 },
            { label: 'Medical inflation carried forward', amount: bd?.inflationBuffer ?? 0 },
            { label: 'Buffer for a second illness in the same year', amount: bd?.multiIncidentBuffer ?? 0 },
        ].filter((r) => r.amount !== 0);

    const age = inputs.exactAge ?? undefined;
    const facts: [string, string | null | undefined][] = [
        ['Age', age ? `${age}` : inputs.ageBand],
        ['City', inputs.city ? `${inputs.city} · ${inputs.cityTier}` : inputs.cityTier],
        ['Household', inputs.familyStructure],
        ['Employer cover', inputs.employerCover],
        ['Risk posture', inputs.riskPosture],
        ['Travels abroad', inputs.globalTravel],
    ];

    return (
        <Document
            title={`IndSure cover calculation — ${lakhs(total)}`}
            author="IndSure"
            subject="Health cover requirement"
        >
            <Page size="A4" style={s.page}>
                <View
                    style={s.runHead}
                    fixed
                    render={({ pageNumber }) =>
                        pageNumber > 1 ? (
                            <>
                                <Text style={s.micro}>INDSURE COVER CALCULATION</Text>
                                <Text style={s.micro}>{lakhs(total).toUpperCase()}</Text>
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
                                    Arithmetic only. IndSure sells no insurance and earns no commission.
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
                    <Image style={s.wordmark} src={getPdfLogoSrc()} />
                    <Text style={s.eyebrow}>Cover calculation · {generatedLabel}</Text>
                </View>

                {/* ---------------------------------------------- hero */}
                <View style={s.kickerRow}>
                    <Svg width={7} height={7} viewBox="0 0 8 8" style={{ marginRight: 6 }}>
                        <Path d="M4 0 L8 4 L4 8 L0 4 Z" fill={C.teal} />
                    </Svg>
                    <Text style={s.kicker}>What you need</Text>
                </View>

                <Display style={s.headline}>{`${lakhs(total)} of health cover`}</Display>
                <Text style={s.deck}>
                    Worked out from the worst realistic hospitalisation for your age, adjusted for your
                    city and your health, carried forward for medical inflation. This is the amount, not
                    a product. Nothing here depends on which policy you eventually buy.
                </Text>

                {/* ---------------------------------------------- facts */}
                <View style={s.facts}>
                    {facts
                        .filter(([, v]) => v != null && String(v).trim() !== '')
                        .map(([k, v]) => (
                            <View style={s.fact} key={k}>
                                <Text style={s.factLabel}>{k}</Text>
                                <Text style={s.factValue}>{String(v)}</Text>
                            </View>
                        ))}
                </View>

                {/* ---------------------------------------------- the two options */}
                {plans && (
                    <>
                        <SectionHead
                            title="Two ways to buy it"
                            note={plans.hasSplit ? 'same cover, two prices' : 'single policy'}
                        />
                        <View style={s.optRow}>
                            <View style={s.optCell}>
                                <Text style={s.optName}>Optimal</Text>
                                <Display style={s.optHeadline}>{lakhs(plans.optimal.baseSI)}</Display>
                                <Text style={s.optSub}>One base policy, plus the riders below.</Text>
                                <View style={s.optLine}>
                                    <Text style={s.optKey}>Base policy</Text>
                                    <Text style={s.optVal}>{lakhs(plans.optimal.baseSI)}</Text>
                                </View>
                                <View style={s.optLine}>
                                    <Text style={s.optKey}>Super top-up</Text>
                                    <Text style={s.optVal}>None</Text>
                                </View>
                                <View style={s.optLine}>
                                    <Text style={s.optKey}>Total cover</Text>
                                    <Text style={s.optVal}>{lakhs(plans.optimal.totalSI)}</Text>
                                </View>
                                <View style={s.optPremium}>
                                    <Text style={s.optKey}>Estimated annual premium</Text>
                                    <Text style={s.optPremiumVal}>
                                        {range(
                                            plans.optimal.premiumEstimate.annual.min,
                                            plans.optimal.premiumEstimate.annual.max,
                                        )}
                                    </Text>
                                </View>
                            </View>

                            <View style={s.optCellSplit}>
                                <Text style={s.optName}>Cost efficient</Text>
                                <Display style={s.optHeadline}>
                                    {plans.hasSplit
                                        ? `${lakhs(plans.efficient.baseSI)} + ${lakhs(plans.efficient.topUpSI)}`
                                        : lakhs(plans.efficient.baseSI)}
                                </Display>
                                <Text style={s.optSub}>
                                    {plans.hasSplit
                                        ? 'Base policy plus a super top-up, plus the riders below.'
                                        : 'The gap was too small to justify a separate top-up.'}
                                </Text>
                                <View style={s.optLine}>
                                    <Text style={s.optKey}>Base policy</Text>
                                    <Text style={s.optVal}>{lakhs(plans.efficient.baseSI)}</Text>
                                </View>
                                <View style={s.optLine}>
                                    <Text style={s.optKey}>Super top-up</Text>
                                    <Text style={s.optVal}>
                                        {plans.efficient.topUpSI > 0 ? lakhs(plans.efficient.topUpSI) : 'None'}
                                    </Text>
                                </View>
                                <View style={s.optLine}>
                                    <Text style={s.optKey}>Total cover</Text>
                                    <Text style={s.optVal}>{lakhs(plans.efficient.totalSI)}</Text>
                                </View>
                                <View style={s.optPremium}>
                                    <Text style={s.optKey}>Estimated annual premium</Text>
                                    <Text style={s.optPremiumVal}>
                                        {range(
                                            plans.efficient.premiumEstimate.annual.min,
                                            plans.efficient.premiumEstimate.annual.max,
                                        )}
                                    </Text>
                                </View>
                                {plans.hasSplit && saving > 0 ? (
                                    <Text style={s.saveTag}>
                                        {saving}% less premium for the same {lakhs(plans.efficient.totalSI)}.
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    </>
                )}

                {/* ---------------------------------------------- build-up */}
                {bd && (
                    <>
                        <SectionHead title="How the number was built" note="every step, in order" />
                        {ledger.map((row, i) => (
                            <View style={s.buildRow} key={i}>
                                <Text style={s.buildKey}>{row.label}</Text>
                                <Text
                                    style={[
                                        s.buildVal,
                                        row.amount < 0 ? { color: C.muted } : {},
                                    ]}
                                >
                                    {i === 0 ? '' : row.amount < 0 ? '\u2212 ' : '+ '}
                                    {inr(Math.abs(row.amount))}
                                </Text>
                            </View>
                        ))}
                        <View style={s.buildTotal}>
                            <Text style={s.buildTotalKey}>What you need</Text>
                            <Text style={s.buildTotalVal}>{inr(bd.finalOptimal)}</Text>
                        </View>
                    </>
                )}

                {/* ---------------------------------------------- reasoning */}
                {result.reasoning?.length > 0 && (
                    <>
                        <SectionHead title="Why this structure" note={`${result.reasoning.length} reasons`} />
                        {result.reasoning.map((r, i) => (
                            <Bullet key={i}>{r}</Bullet>
                        ))}
                    </>
                )}

                {/* ---------------------------------------------- riders */}
                {result.riders?.length > 0 && (
                    <>
                        <SectionHead title="Riders worth adding" note={`${result.riders.length} suggested`} />
                        {result.riders.map((r, i) => (
                            <View style={s.rider} key={i} wrap={false}>
                                <View style={s.riderTop}>
                                    <Text style={s.riderName}>{r.name}</Text>
                                    <Text
                                        style={[
                                            s.riderPriority,
                                            { color: PRIORITY_COLOUR[r.priority] ?? C.muted },
                                        ]}
                                    >
                                        {r.priority}
                                    </Text>
                                </View>
                                <Text style={s.riderReason}>{r.reason}</Text>
                            </View>
                        ))}
                    </>
                )}

                {/* ---------------------------------------------- projection */}
                {result.fiveYearProjection?.length > 0 && (
                    <>
                        <SectionHead title="Premium over five years" note="at the upper estimate" />
                        <View style={s.projHead}>
                            <Text style={[s.projCellHead, { width: '20%' }]}>Year</Text>
                            <Text style={[s.projCellHead, { width: '40%' }]}>Annual premium</Text>
                            <Text style={[s.projCellHead, { width: '40%' }]}>Paid so far</Text>
                        </View>
                        {result.fiveYearProjection.map((row) => (
                            <View style={s.projRow} key={row.year}>
                                <Text style={[s.projCell, { width: '20%' }]}>{row.year}</Text>
                                <Text style={[s.projCell, { width: '40%' }]}>{inr(row.premium)}</Text>
                                <Text style={[s.projCell, { width: '40%' }]}>{inr(row.cumulative)}</Text>
                            </View>
                        ))}
                    </>
                )}

                {/* ---------------------------------------------- mistakes */}
                {result.commonMistakes?.length > 0 && (
                    <>
                        <SectionHead title="What people get wrong" note="worth reading twice" />
                        {result.commonMistakes.map((m, i) => (
                            <Bullet key={i}>{m}</Bullet>
                        ))}
                    </>
                )}

                {/* ---------------------------------------------- sensitivity */}
                {result.sensitivityAnalysis?.length > 0 && (
                    <>
                        <SectionHead title="What would change this number" />
                        {result.sensitivityAnalysis.map((x, i) => (
                            <Bullet key={i}>{x}</Bullet>
                        ))}
                    </>
                )}

                {/* ---------------------------------------------- close */}
                <Text style={s.disclaimer}>
                    Not insurance or financial advice. This calculation is for informational purposes only
                    and does not constitute a recommendation to purchase any insurance product. Premium
                    figures are indicative estimates, not quotes, and are not based on insurer-specific
                    data. Your actual premium depends on medical underwriting. Consult a licensed
                    insurance advisor before making any decision.
                </Text>
            </Page>
        </Document>
    );
};
