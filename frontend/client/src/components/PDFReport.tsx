import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { AnalysisResponse } from '@/lib/types';

// Register fonts if needed
// Font.register({ family: 'Inter', src: '/fonts/Inter-Regular.ttf' });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '2 solid #1A3A52',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A3A52',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A3A52',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1 solid #E5E7EB',
  },
  card: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    marginBottom: 12,
    borderRadius: 4,
    border: '1 solid #E5E7EB',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  gridItem: {
    width: '48%',
    marginBottom: 8,
    marginRight: '2%',
  },
  label: {
    fontSize: 8,
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 11,
    color: '#111827',
    fontWeight: 'bold',
  },
  bulletList: {
    marginLeft: 8,
    marginBottom: 8,
  },
  bulletItem: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 6,
    paddingLeft: 8,
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#4A9B9E',
    color: '#FFFFFF',
    padding: '4 8',
    borderRadius: 4,
    fontSize: 8,
    marginBottom: 8,
  },
  verdictBox: {
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 4,
    border: '2 solid #10B981',
    marginBottom: 16,
  },
  verdictText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9CA3AF',
    borderTop: '1 solid #E5E7EB',
    paddingTop: 8,
  },
});

interface PDFReportProps {
  data: AnalysisResponse;
}

export const PDFReport: React.FC<PDFReportProps> = ({ data }) => {
  const { policyholderInfo, page1, details, recommendations } = data;
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Insurance Coverage Report</Text>
          <Text style={styles.subtitle}>Generated on {currentDate}</Text>
          {page1?.asOf && (
            <Text style={styles.subtitle}>{page1.asOf}</Text>
          )}
        </View>

        {/* Policyholder Information */}
        {policyholderInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Policyholder Information</Text>
            {policyholderInfo.policyType && (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.badge}>{policyholderInfo.policyType}</Text>
              </View>
            )}
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>{policyholderInfo.name || "—"}</Text>
              </View>
              {policyholderInfo.age && (
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Age</Text>
                  <Text style={styles.value}>{policyholderInfo.age} years</Text>
                </View>
              )}
              <View style={styles.gridItem}>
                <Text style={styles.label}>City</Text>
                <Text style={styles.value}>{policyholderInfo.city || "—"}</Text>
              </View>
              {policyholderInfo.policyNumber && (
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Policy Number</Text>
                  <Text style={styles.value}>{policyholderInfo.policyNumber}</Text>
                </View>
              )}
            </View>
            {policyholderInfo.policyType === "Family Floater" && policyholderInfo.members && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.label, { marginBottom: 8 }]}>Family Members</Text>
                {policyholderInfo.members.map((member: any, i: number) => (
                  <View key={i} style={styles.card}>
                    <Text style={styles.value}>{member.name}</Text>
                    <Text style={styles.label}>
                      {member.relationship || "Member"} • {member.age ? `${member.age} years` : ""} {member.gender && member.gender !== "Not specified" ? `• ${member.gender}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Coverage Assessment */}
        {page1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coverage Assessment</Text>
            <View style={styles.verdictBox}>
              <Text style={styles.verdictText}>{page1.verdict || "Unknown"}</Text>
              {page1.why && (
                <Text style={[styles.bulletItem, { color: '#065F46' }]}>{page1.why}</Text>
              )}
            </View>
          </View>
        )}

        {/* What You're Covered For */}
        {page1?.coveredFor && page1.coveredFor.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What You're Covered For</Text>
            <View style={styles.bulletList}>
              {page1.coveredFor.map((item: string, i: number) => (
                <Text key={i} style={styles.bulletItem}>✓ {item}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Potential Risks */}
        {page1?.whereItHurts && page1.whereItHurts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Potential Risks</Text>
            <View style={styles.bulletList}>
              {page1.whereItHurts.map((item: string, i: number) => (
                <Text key={i} style={[styles.bulletItem, { color: '#DC2626' }]}>⚠ {item}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Cost Context */}
        {page1?.costContext && page1.costContext.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Real-World Cost Scenarios</Text>
            {page1.costContext.map((scenario: string, i: number) => (
              <View key={i} style={styles.card}>
                <Text style={[styles.label, { fontWeight: 'bold', marginBottom: 4 }]}>Scenario {i + 1}</Text>
                <Text style={styles.bulletItem}>{scenario}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          This report was generated by Ensured - Decision-first insurance analysis. No sales. No storage.
        </Text>
      </Page>

      {/* Second Page - Details */}
      <Page size="A4" style={styles.page}>
        {details && (
          <>
            {/* Policy Summary */}
            {details.policySummary && details.policySummary.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Policy Summary</Text>
                <View style={styles.bulletList}>
                  {details.policySummary.map((item: string, i: number) => (
                    <Text key={i} style={styles.bulletItem}>• {item}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Active Waiting Periods */}
            {details.activeWaitingPeriods && details.activeWaitingPeriods.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active Waiting Periods</Text>
                <View style={styles.bulletList}>
                  {details.activeWaitingPeriods.map((item: string, i: number) => (
                    <Text key={i} style={[styles.bulletItem, { color: '#D97706' }]}>⏳ {item}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Serious Gaps */}
            {details.gaps?.serious && details.gaps.serious.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>Serious Gaps</Text>
                <View style={styles.bulletList}>
                  {details.gaps.serious.map((item: string, i: number) => (
                    <Text key={i} style={[styles.bulletItem, { color: '#DC2626' }]}>⚠ {item}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Minor Gaps */}
            {details.gaps?.nonSerious && details.gaps.nonSerious.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: '#D97706' }]}>Minor Gaps</Text>
                <View style={styles.bulletList}>
                  {details.gaps.nonSerious.map((item: string, i: number) => (
                    <Text key={i} style={[styles.bulletItem, { color: '#D97706' }]}>ℹ {item}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Recommendations */}
            {recommendations && recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommended Actions</Text>
                {recommendations.map((rec: string, i: number) => {
                  const cleanRec = rec.replace(/\*\*\[Priority:\s*(High|Medium|Low)\]\*\*\s*/, '');
                  const priorityMatch = rec.match(/\*\*\[Priority:\s*(High|Medium|Low)\]\*\*/);
                  const priority = priorityMatch ? priorityMatch[1] : null;
                  
                  return (
                    <View key={i} style={[styles.card, { marginBottom: 8 }]}>
                      {priority && (
                        <Text style={[styles.label, { 
                          color: priority === 'High' ? '#DC2626' : priority === 'Medium' ? '#D97706' : '#2563EB',
                          fontWeight: 'bold',
                          marginBottom: 4
                        }]}>
                          Priority: {priority}
                        </Text>
                      )}
                      <Text style={styles.bulletItem}>{i + 1}. {cleanRec}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        <Text style={styles.footer}>
          Page 2 of 2 - Ensured Insurance Analysis Report
        </Text>
      </Page>
    </Document>
  );
};

