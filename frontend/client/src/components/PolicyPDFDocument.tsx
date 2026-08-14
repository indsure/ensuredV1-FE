import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font
} from '@react-pdf/renderer';
import { ForensicAuditReport } from "../../../../backend/server/types/policy";

// Font.register for full Unicode support (fixes Rupee symbol rendering)
Font.register({
    family: 'NotoSans',
    fonts: [
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff' },
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff', fontWeight: 700 },
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans/files/noto-sans-latin-400-italic.woff', fontStyle: 'italic' },
    ]
});

Font.register({
    family: 'Playfair Display',
    fonts: [
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff', fontStyle: 'italic', fontWeight: 400 }
    ]
});

// Brand Theme
const THEME = {
    navy: '#0B1120',
    teal: '#0D9488',
    borderLight: '#E2E8F0',
    creamMain: '#FAFAF8',
    creamDark: '#F0F0ED',
    gold: '#B45309',
    redText: '#991B1B',
    redBg: '#FEE2E2',
    redBorder: '#FCA5A5',
    greenText: '#065F46',
    greenBg: '#D1FAE5',
    greenBorder: '#86EFAC',
    amberText: '#92400E',
    amberBg: '#FEF3C7',
    amberBorder: '#FCD34D',
    slateMuted: '#64748B',
    slateLight: '#F8FAFC'
};

/** Plain-English names for the other-cover kinds the audit can return. */
const OTHER_COVER_LABEL_PDF: Record<string, string> = {
    super_topup: 'Super top-up',
    corporate: 'Company / corporate policy',
    ayushman: 'Ayushman Bharat (PM-JAY)'
};

const formatCurrencyPDF = (val: number | null | undefined): string =>
    typeof val === 'number' ? `₹${val.toLocaleString('en-IN')}` : '—';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        backgroundColor: '#FFFFFF',
        fontFamily: 'NotoSans',
    },
    headerBanner: {
        backgroundColor: THEME.navy,
        color: '#FFF',
        padding: 30,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    logoBox: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    logoIcon: {
        width: 24,
        height: 24,
        backgroundColor: THEME.teal,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 2,
        marginRight: 8
    },
    logoI: {
        fontWeight: 700,
        color: '#FFF',
        fontSize: 16
    },
    logoText: {
        fontWeight: 700,
        fontSize: 20,
        letterSpacing: -0.5
    },
    headerMeta: {
        alignItems: 'flex-end'
    },
    headerText: {
        fontSize: 10,
        color: '#CBD5E1',
        opacity: 0.8,
        marginBottom: 4,
        textTransform: 'uppercase'
    },
    headerDate: {
        fontSize: 8,
        color: '#94A3B8',
        marginTop: 4
    },
    insuredName: {
        fontSize: 16,
        fontWeight: 700
    },
    verdictContainer: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 20
    },
    scoreBox: {
        backgroundColor: THEME.creamMain,
        borderWidth: 1,
        borderColor: THEME.borderLight,
        padding: 20,
        borderRadius: 8,
        width: '30%',
        alignItems: 'center',
        justifyContent: 'center'
    },
    scoreNumber: {
        fontSize: 48,
        fontWeight: 700,
        color: THEME.teal,
        marginBottom: 5
    },
    scoreLabel: {
        fontSize: 8,
        color: '#64748B',
        textTransform: 'uppercase',
        fontWeight: 700
    },
    verdictSummaryBox: {
        backgroundColor: THEME.creamMain,
        borderWidth: 1,
        borderColor: THEME.borderLight,
        padding: 20,
        borderRadius: 8,
        width: '70%',
        justifyContent: 'center'
    },
    verdictLabel: {
        fontSize: 10,
        color: THEME.teal,
        fontWeight: 700,
        textTransform: 'uppercase',
        marginBottom: 8
    },
    verdictSummary: {
        fontSize: 16,
        fontWeight: 700,
        color: THEME.navy,
        lineHeight: 1.3
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 700,
        color: '#64748B',
        marginBottom: 10,
        marginTop: 15,
        borderBottomWidth: 1,
        borderBottomColor: THEME.borderLight,
        paddingBottom: 5,
        textTransform: 'uppercase'
    },
    pillRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20
    },
    pill: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 6,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    pillTitle: {
        fontSize: 8,
        textTransform: 'uppercase',
        fontWeight: 700,
        marginBottom: 4,
        textAlign: 'center'
    },
    pillValue: {
        fontSize: 12,
        fontWeight: 700
    },
    twoColumn: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 15
    },
    column: {
        flex: 1,
        flexDirection: 'column'
    },
    strengthCard: {
        borderLeftWidth: 4,
        borderLeftColor: THEME.teal,
        backgroundColor: THEME.creamMain,
        padding: 12,
        marginBottom: 10,
        borderRadius: 4,
        flexGrow: 1
    },
    gapCard: {
        borderLeftWidth: 4,
        backgroundColor: THEME.redBg,
        padding: 12,
        marginBottom: 10,
        borderRadius: 4,
        flexGrow: 1
    },
    cardTitle: {
        fontSize: 10,
        fontWeight: 700,
        color: THEME.navy,
        marginBottom: 4
    },
    cardText: {
        fontSize: 9,
        color: '#334155',
        lineHeight: 1.4
    },
    cardSubGreen: {
        fontSize: 9,
        color: THEME.teal,
        marginTop: 6,
        fontStyle: 'italic',
        fontWeight: 700
    },
    cardSubRed: {
        fontSize: 9,
        color: THEME.redText,
        marginTop: 6,
        fontStyle: 'italic',
        fontWeight: 700
    },
    simRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.slateLight,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
        padding: 12,
        marginBottom: 4,
        borderRadius: 4
    },
    simColLeft: { flex: 2 },
    simColRight: { flex: 1, alignItems: 'flex-end' },
    simTitle: { fontSize: 10, fontWeight: 700, color: THEME.navy },
    simValBox: { fontSize: 9, fontWeight: 700 },
    simLabel: { fontSize: 7, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20
    },
    gridBox: {
        borderWidth: 1,
        borderColor: THEME.borderLight,
        backgroundColor: THEME.creamMain,
        borderRadius: 6,
        padding: 12,
        width: '48%',
        marginBottom: 10
    },
    wpRow: {
        borderWidth: 1,
        borderColor: THEME.borderLight,
        borderRadius: 6,
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#FFF'
    },
    wpHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    wpTitle: { fontSize: 10, fontWeight: 700, color: THEME.navy },
    wpStatusServed: { fontSize: 9, fontWeight: 700, color: THEME.greenText },
    wpStatusPending: { fontSize: 9, fontWeight: 700, color: THEME.amberText },
    wpDuration: { fontSize: 8, color: '#64748B', marginBottom: 6 },
    progressBarBg: {
        height: 4,
        backgroundColor: THEME.creamDark,
        borderRadius: 2,
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: THEME.amberBorder
    },
    recCard: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 6,
        backgroundColor: THEME.creamMain,
        borderColor: THEME.borderLight,
        borderWidth: 1,
        marginBottom: 10,
        gap: 12
    },
    recNumberBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: THEME.teal,
        alignItems: 'center',
        justifyContent: 'center'
    },
    recNumberText: { color: '#FFF', fontSize: 10, fontWeight: 700 },
    recContent: { flex: 1 },
    recTitle: { fontSize: 10, fontWeight: 700, color: THEME.navy, marginBottom: 4 },
    portBannerGreen: {
        backgroundColor: THEME.greenBg,
        borderColor: THEME.greenBorder,
        borderWidth: 1,
        padding: 15,
        borderRadius: 8,
        marginTop: 10
    },
    portBannerAmber: {
        backgroundColor: THEME.amberBg,
        borderColor: THEME.amberBorder,
        borderWidth: 1,
        padding: 15,
        borderRadius: 8,
        marginTop: 10
    },
    quoteBox: {
        backgroundColor: THEME.navy,
        padding: 24,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 'auto'
    },
    quoteText: {
        fontFamily: 'Playfair Display',
        fontSize: 16,
        fontStyle: 'italic',
        color: '#FFF'
    },
    footer: {
        marginTop: 15,
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: THEME.borderLight,
        paddingTop: 10
    },
    footerText: {
        fontSize: 8,
        color: '#94A3B8'
    }
});

interface Props {
    data: ForensicAuditReport;
}

export const PolicyPDFDocument: React.FC<Props> = ({ data }) => {

    const currentDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    const policyAgeDays = data.policy_timeline?.policy_age_days ?? 0;

    const getPillStyle = (key: string, value: number) => {
        let max = 0;
        let style = { bg: THEME.creamMain, text: THEME.navy, max: 0 };

        if (key === 'claim_rejection_risk') {
            max = 30;
            style = value === 0 ? { bg: THEME.greenBg, text: THEME.greenText, max } : { bg: THEME.amberBg, text: THEME.amberText, max };
        }
        if (key === 'oop_exposure') {
            max = 30;
            style = value === 0 ? { bg: THEME.greenBg, text: THEME.greenText, max } : { bg: THEME.amberBg, text: THEME.amberText, max };
        }
        if (key === 'coverage_quality_gap') {
            max = 20;
            style = value > 0 ? { bg: THEME.amberBg, text: THEME.amberText, max } : { bg: THEME.greenBg, text: THEME.greenText, max };
        }
        if (key === 'net_cover_penalty') {
            max = 20;
            style = value > 0 ? { bg: THEME.redBg, text: THEME.redText, max } : { bg: THEME.greenBg, text: THEME.greenText, max };
        }
        return style;
    };

    const crR = getPillStyle('claim_rejection_risk', data.audit_score.breakdown.claim_rejection_risk);
    const oop = getPillStyle('oop_exposure', data.audit_score.breakdown.oop_exposure);
    const cqg = getPillStyle('coverage_quality_gap', data.audit_score.breakdown.coverage_quality_gap);
    const ncp = getPillStyle('net_cover_penalty', data.audit_score.breakdown.net_cover_penalty);

    const renderWaitingPeriod = (title: string, wp: any, durationDays: number, keyIndex?: number) => {
        if (!wp || wp.relevant === false) return null;

        // No duration anywhere in the document — do not infer "Served" from a zero duration.
        if (wp.duration_months == null) {
            return (
                <View style={styles.wpRow} key={keyIndex}>
                    <View style={styles.wpHeader}>
                        <Text style={styles.wpTitle}>{title}</Text>
                        <Text style={styles.wpStatusPending}>⚠ Not stated — verify with insurer</Text>
                    </View>
                </View>
            );
        }

        // Estimated (e.g. PED derived from the specific-illness waiting period).
        const estimated = wp.stated === false;
        const isResolved = wp.is_active_today === false || (wp.months_remaining === 0) || (policyAgeDays >= durationDays);
        const progress = isResolved ? 100 : Math.min(100, Math.max(0, (policyAgeDays / durationDays) * 100));

        return (
            <View style={styles.wpRow} key={keyIndex}>
                <View style={styles.wpHeader}>
                    <Text style={styles.wpTitle}>{title}{estimated ? " (est.)" : ""}</Text>
                    {isResolved ? (
                        <Text style={styles.wpStatusServed}>✓ Served{estimated ? " (est.)" : ""}</Text>
                    ) : (
                        <Text style={styles.wpStatusPending}>⏳ Pending ({wp.months_remaining} mo left){estimated ? ", est." : ""}</Text>
                    )}
                </View>
                {!isResolved && (
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                    </View>
                )}
            </View>
        );
    };

    const allRecommendations = [
        ...(data.recommendations?.critical_actions ?? []).map(r => ({ ...r, level: 'critical' })),
        ...(data.recommendations?.medium_priority ?? []).map(r => ({ ...r, level: 'medium' })),
        ...(data.recommendations?.low_priority ?? []).map(r => ({ ...r, level: 'low' }))
    ];

    const formatCurr = (val: number | string | null | undefined) => {
        if (val === null || val === undefined) return 'N/A';
        if (typeof val === 'number') return `₹${val.toLocaleString('en-IN')}`;
        return val.toString(); // strings from data often already contain ₹
    };

    return (
        <Document>
            {/* PAGE 1 */}
            <Page size="A4" style={styles.page}>

                {/* Header Block */}
                <View style={styles.headerBanner} wrap={false}>
                    <View style={styles.logoBox}>
                        <View style={styles.logoIcon}>
                            <Text style={styles.logoI}>I</Text>
                        </View>
                        <Text style={styles.logoText}>IndSure.</Text>
                    </View>
                    <View style={styles.headerMeta}>
                        <Text style={styles.headerText}>FORENSIC AUDIT REPORT</Text>
                        <Text style={styles.insuredName}>{data.identity.insured_names.join(', ')}</Text>
                        <Text style={styles.headerDate}>{currentDate}</Text>
                    </View>
                </View>

                {/* Verdict Summary */}
                <View style={styles.verdictContainer} wrap={false}>
                    <View style={styles.scoreBox}>
                        <Text style={styles.scoreNumber}>{data.audit_score.score}</Text>
                        <Text style={styles.scoreLabel}>Audit Score</Text>
                        {data.audit_score.bucket_label && (
                            <Text style={{ fontSize: 8, marginTop: 2, color: '#64748B', fontWeight: 600 }}>
                                {data.audit_score.bucket_label}
                            </Text>
                        )}
                        {typeof data.audit_score.ncar === 'number' && (
                            <Text style={{ fontSize: 7, marginTop: 4, color: '#94A3B8' }}>NCAR: {data.audit_score.ncar.toFixed(2)}x</Text>
                        )}
                    </View>
                    <View style={styles.verdictSummaryBox}>
                        <Text style={styles.verdictLabel}>{data.final_verdict.label}</Text>
                        <Text style={styles.verdictSummary}>{data.final_verdict.summary}</Text>
                    </View>
                </View>

                {/* Pills */}
                <Text style={styles.sectionTitle}>Breakdown of Automated Deductions</Text>
                <View style={styles.pillRow} wrap={false}>
                    <View style={[styles.pill, { backgroundColor: crR.bg }]}>
                        <Text style={[styles.pillTitle, { color: crR.text }]}>Claim Rejection Risk</Text>
                        <Text style={[styles.pillValue, { color: crR.text }]}>{data.audit_score.breakdown.claim_rejection_risk} / {crR.max}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: oop.bg }]}>
                        <Text style={[styles.pillTitle, { color: oop.text }]}>OOP Exposure</Text>
                        <Text style={[styles.pillValue, { color: oop.text }]}>{data.audit_score.breakdown.oop_exposure} / {oop.max}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: cqg.bg }]}>
                        <Text style={[styles.pillTitle, { color: cqg.text }]}>Coverage Gap</Text>
                        <Text style={[styles.pillValue, { color: cqg.text }]}>{data.audit_score.breakdown.coverage_quality_gap} / {cqg.max}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: ncp.bg }]}>
                        <Text style={[styles.pillTitle, { color: ncp.text }]}>Net Cover Penalty</Text>
                        <Text style={[styles.pillValue, { color: ncp.text }]}>{data.audit_score.breakdown.net_cover_penalty} / {ncp.max}</Text>
                    </View>
                </View>

                {/* Strengths & Gaps */}
                <View style={[styles.twoColumn, { alignItems: 'stretch' }]} wrap={false}>
                    <View style={styles.column}>
                        <Text style={styles.sectionTitle}>What Actually Works</Text>
                        {(data.benefit_evaluation?.what_actually_works ?? []).map((item, i) => (
                            <View style={styles.strengthCard} key={i}>
                                <Text style={styles.cardTitle}>{item.benefit}</Text>
                                <Text style={styles.cardText}>{item.why_it_matters_in_claim}</Text>
                                {item.quantified_value && <Text style={styles.cardSubGreen}>{item.quantified_value}</Text>}
                            </View>
                        ))}
                    </View>
                    <View style={styles.column}>
                        <Text style={styles.sectionTitle}>Where It May Cost You</Text>
                        {(data.benefit_evaluation?.where_policy_fails ?? []).map((item, i) => (
                            <View style={[styles.gapCard, { borderLeftColor: THEME.amberBorder, backgroundColor: THEME.amberBg }]} key={i}>
                                <Text style={styles.cardTitle}>{item.issue}</Text>
                                <Text style={styles.cardText}>{item.real_world_claim_impact}</Text>
                                {item.quantified_oop_risk && <Text style={styles.cardSubRed}>{item.quantified_oop_risk}</Text>}
                            </View>
                        ))}
                    </View>
                </View>

                {/* Claim Simulations */}
                {(data.claim_simulations?.length ?? 0) > 0 && (
                    <View wrap={false}>
                        <Text style={styles.sectionTitle}>Simulated Scenario Projections</Text>
                        {data.claim_simulations!.map((sim, i) => {
                            const oopCost = sim.total_bill - sim.insurer_pays;
                            const isZeroOOP = oopCost === 0;
                            return (
                                <View style={styles.simRow} key={i}>
                                    <View style={styles.simColLeft}>
                                        <Text style={styles.simTitle}>{sim.scenario}</Text>
                                    </View>
                                    <View style={styles.simColRight}>
                                        <Text style={styles.simLabel}>Total Bill</Text>
                                        <Text style={styles.simValBox}>{formatCurr(sim.total_bill)}</Text>
                                    </View>
                                    <View style={styles.simColRight}>
                                        <Text style={styles.simLabel}>Insurer Pays</Text>
                                        <Text style={[styles.simValBox, { color: THEME.teal }]}>{formatCurr(sim.insurer_pays)}</Text>
                                    </View>
                                    <View style={styles.simColRight}>
                                        <Text style={styles.simLabel}>Out of Pocket</Text>
                                        <Text style={[styles.simValBox, { color: isZeroOOP ? THEME.greenText : THEME.redText }]}>{formatCurr(oopCost)}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Report generated by IndSure. AI-computed metrics based on policy document text. Page 1 of 2</Text>
                </View>
            </Page>

            {/* PAGE 2 */}
            <Page size="A4" style={styles.page}>
                <View style={[styles.headerBanner, { padding: 15, marginBottom: 20 }]} wrap={false}>
                    <View style={styles.logoBox}>
                        <View style={styles.logoIcon}>
                            <Text style={styles.logoI}>I</Text>
                        </View>
                        <Text style={[styles.logoText, { fontSize: 14 }]}>IndSure.</Text>
                    </View>
                    <Text style={styles.headerText}>Policy Data Details</Text>
                </View>

                {/* Financial Caps */}
                <Text style={styles.sectionTitle}>Financial Limits & Caps</Text>
                <View style={styles.gridContainer} wrap={false}>
                    <View style={styles.gridBox}>
                        <Text style={styles.simLabel}>Room Rent Logic</Text>
                        <Text style={styles.cardTitle}>{data.claim_risk_analysis.room_rent.limit_type === 'none' ? 'No Sub-Limit' : data.claim_risk_analysis.room_rent.limit_value}</Text>
                    </View>
                    <View style={styles.gridBox}>
                        <Text style={styles.simLabel}>Co-Payment Logic</Text>
                        <Text style={styles.cardTitle}>{data.claim_risk_analysis.co_payment.exists ? `${data.claim_risk_analysis.co_payment.percentage}% applies` : 'No automatic deductions'}</Text>
                    </View>
                    <View style={styles.gridBox}>
                        <Text style={styles.simLabel}>OOP on ₹5L Claim</Text>
                        <Text style={[styles.cardTitle, { color: data.claim_risk_analysis.co_payment.oop_on_5L_claim === 0 ? THEME.greenText : THEME.amberText }]}>
                            {formatCurr(data.claim_risk_analysis.co_payment.oop_on_5L_claim)}
                        </Text>
                    </View>
                    <View style={styles.gridBox}>
                        <Text style={styles.simLabel}>Cashless Hospital Count</Text>
                        <Text style={styles.cardTitle}>{data.network_limitations.hospital_count_in_zone ?? 'N/A'}</Text>
                    </View>
                </View>

                <View style={styles.twoColumn} wrap={false}>
                    <View style={styles.column}>
                        <Text style={styles.sectionTitle}>Waiting Period Analysis</Text>
                        {renderWaitingPeriod("Initial Waiting (30 days)", data.waiting_period_analysis.initial_waiting_period, 30)}
                        {renderWaitingPeriod("Pre-Existing Diseases", data.waiting_period_analysis.pre_existing_disease, (data.waiting_period_analysis.pre_existing_disease?.duration_months ?? 0) * 30)}
                        {renderWaitingPeriod("Specific Diseases", data.waiting_period_analysis.specific_diseases, (data.waiting_period_analysis.specific_diseases?.duration_months ?? 0) * 30)}
                        {data.waiting_period_analysis.personal_waiting_periods?.map((wp, i) => renderWaitingPeriod(`Condition: ${wp.condition}`, wp, wp.duration_months * 30, i))}
                        {data.waiting_period_analysis.maternity?.relevant && renderWaitingPeriod("Maternity waiting", data.waiting_period_analysis.maternity, (data.waiting_period_analysis.maternity.duration_months ?? 0) * 30)}
                    </View>

                    <View style={styles.column}>
                        <Text style={styles.sectionTitle}>Supplementary Coverage</Text>
                        {Object.entries(data.supplementary_coverage || {}).map(([key, val]) => {
                            if (!val || typeof val !== 'object') return null;
                            const isCovered = (val as any).covered === true;
                            return (
                                <View style={[styles.wpRow, { flexDirection: 'row', alignItems: 'center' }]} key={key}>
                                    <Text style={{ fontSize: 10, marginRight: 6 }}>{isCovered ? '✓' : '✗'}</Text>
                                    <Text style={[styles.cardTitle, { marginBottom: 0, color: isCovered ? THEME.greenText : THEME.redText }]}>
                                        {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Other cover held. Rendered only when other policies were
                    uploaded with this one — absent on every pre-feature report. */}
                {((data.other_cover?.length ?? 0) > 0 || data.cover_stack) && (
                    <View wrap={false}>
                        <Text style={styles.sectionTitle}>Other Cover Held</Text>

                        {data.cover_stack && typeof data.cover_stack.combined_effective_cover === 'number' && (
                            <View style={styles.wpRow}>
                                <Text style={styles.cardTitle}>
                                    Usable cover across all policies: {formatCurrencyPDF(data.cover_stack.combined_effective_cover)}
                                    {typeof data.cover_stack.required_cover === 'number'
                                        ? ` of ${formatCurrencyPDF(data.cover_stack.required_cover)} needed`
                                        : ''}
                                    {data.cover_stack.verdict && data.cover_stack.verdict !== 'unclear'
                                        ? ` — ${data.cover_stack.verdict}`
                                        : ''}
                                </Text>
                                {!!data.cover_stack.remarks && (
                                    <Text style={styles.cardText}>{data.cover_stack.remarks}</Text>
                                )}
                                {(data.cover_stack.excluded ?? []).map((e, i) => (
                                    <Text key={i} style={styles.cardText}>• Not counted: {e}</Text>
                                ))}
                                {(data.cover_stack.where_the_stack_still_breaks ?? []).map((e, i) => (
                                    <Text key={i} style={[styles.cardText, { color: THEME.redText }]}>
                                        • Still breaks: {e}
                                    </Text>
                                ))}
                            </View>
                        )}

                        {(data.other_cover ?? []).map((cover, i) => (
                            <View key={i} style={styles.wpRow}>
                                <Text style={styles.cardTitle}>
                                    {OTHER_COVER_LABEL_PDF[cover.kind] ?? cover.kind}
                                    {typeof cover.sum_insured === 'number' ? ` — ${formatCurrencyPDF(cover.sum_insured)}` : ''}
                                    {typeof cover.deductible === 'number' && cover.deductible > 0
                                        ? ` (deductible ${formatCurrencyPDF(cover.deductible)})`
                                        : ''}
                                    {cover.usable_today === false
                                        ? ' — NOT USABLE YET'
                                        : cover.counted_in_total === false
                                        ? ' — NOT IN TOTAL'
                                        : ''}
                                </Text>
                                {!!(cover.insurer || cover.plan_name) && (
                                    <Text style={styles.cardText}>
                                        {[cover.insurer, cover.plan_name].filter(Boolean).join(' — ')}
                                    </Text>
                                )}
                                {(cover.own_limits ?? []).map((l, j) => (
                                    <Text key={j} style={styles.cardText}>• {l}</Text>
                                ))}
                                {!!cover.dependency_risk && (
                                    <Text style={[styles.cardText, { color: THEME.amberText }]}>
                                        What can take it away: {cover.dependency_risk}
                                    </Text>
                                )}
                                {!!cover.what_it_does_not_solve && (
                                    <Text style={styles.cardText}>Does not fix: {cover.what_it_does_not_solve}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Recommendations */}
                <Text style={styles.sectionTitle}>Personalized Recommendations</Text>
                <View wrap={false}>
                    {allRecommendations.map((rec, i) => {
                        const hasCriticalIllness = rec.action.toLowerCase().includes('critical illness');
                        return (
                            <View key={i} style={[styles.recCard, hasCriticalIllness ? { borderLeftWidth: 4, borderLeftColor: THEME.amberBorder } : {}]}>
                                <View style={styles.recNumberBadge}>
                                    <Text style={styles.recNumberText}>{i + 1}</Text>
                                </View>
                                <View style={styles.recContent}>
                                    <Text style={styles.recTitle}>{rec.action}</Text>
                                    <Text style={styles.cardText}>{rec.reason}</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Port Verdict Banner */}
                <View style={data.recommendations.should_port_to_better_policy.recommendation === 'yes' ? styles.portBannerAmber : styles.portBannerGreen} wrap={false}>
                    <Text style={[styles.cardTitle, { color: data.recommendations.should_port_to_better_policy.recommendation === 'yes' ? THEME.amberText : THEME.greenText }]}>
                        {data.recommendations.should_port_to_better_policy.recommendation === 'yes' ? 'Porting Recommended' : 'Stick with this policy'}
                    </Text>
                    <Text style={[styles.cardText, { marginTop: 4 }]}>{data.recommendations.should_port_to_better_policy.reason}</Text>
                </View>

                <View style={styles.quoteBox} wrap={false}>
                    <Text style={styles.quoteText}>"The policy is fixed. Your awareness of it isn't."</Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>All scoring is AI-computed from your policy text. No manual overrides. Page 2 of 2</Text>
                </View>
            </Page>
        </Document>
    );
};
