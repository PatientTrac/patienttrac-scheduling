import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer';

Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2' },
  ],
});

const NAVY  = '#0a1628';
const GOLD  = '#c9a96e';
const LIGHT = '#f7f5f0';
const GRAY  = '#6b7280';
const BORDER = '#e5e0d8';

const S = StyleSheet.create({
  page:      { backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', paddingBottom: 60 },
  header:    { backgroundColor: NAVY, padding: '24 32', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo:      { width: 80, height: 40, objectFit: 'contain' },
  logoPlaceholder: { width: 80, height: 40, backgroundColor: '#1e3a5f', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  facilityName: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  facilityAddr: { color: 'rgba(255,255,255,0.55)', fontSize: 8, textAlign: 'right', marginTop: 2 },
  goldBar:   { height: 3, backgroundColor: GOLD },
  body:      { padding: '28 32' },
  proposalTitle: { fontSize: 22, fontWeight: 'bold', color: NAVY, letterSpacing: 0.5, marginBottom: 4 },
  proposalSubtitle: { fontSize: 11, color: GRAY, marginBottom: 20 },
  infoRow:   { flexDirection: 'row', gap: 16, marginBottom: 20 },
  infoCard:  { flex: 1, backgroundColor: LIGHT, borderRadius: 8, padding: '12 14', border: `1 solid ${BORDER}` },
  infoLabel: { fontSize: 8, color: GRAY, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  infoValue: { fontSize: 11, color: NAVY, fontWeight: 'bold' },
  infoSub:   { fontSize: 9, color: GRAY, marginTop: 1 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: NAVY, borderBottom: `1 solid ${BORDER}`, paddingBottom: 6, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  tableHeader: { flexDirection: 'row', backgroundColor: NAVY, padding: '7 10', borderRadius: 4, marginBottom: 2 },
  tableHeaderText: { color: '#ffffff', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow:  { flexDirection: 'row', padding: '7 10', borderBottom: `1 solid ${BORDER}` },
  tableRowAlt: { backgroundColor: LIGHT },
  col1:      { flex: 3 },
  col2:      { flex: 1, textAlign: 'right' },
  totalRow:  { flexDirection: 'row', padding: '10 10', backgroundColor: NAVY, borderRadius: 4, marginTop: 4 },
  totalLabel: { flex: 3, color: '#ffffff', fontWeight: 'bold', fontSize: 11 },
  totalValue: { flex: 1, color: GOLD, fontWeight: 'bold', fontSize: 13, textAlign: 'right' },
  financingBox: { backgroundColor: LIGHT, borderRadius: 8, padding: '14 16', border: `1.5 solid ${GOLD}`, marginBottom: 20 },
  financingTitle: { fontSize: 11, fontWeight: 'bold', color: NAVY, marginBottom: 6 },
  financingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  financingLabel: { fontSize: 9, color: GRAY },
  financingValue: { fontSize: 9, color: NAVY, fontWeight: 'bold' },
  summaryBox: { backgroundColor: '#f0f4ff', borderRadius: 8, padding: '14 16', border: `1 solid #c7d7ff`, marginBottom: 20 },
  summaryText: { fontSize: 10, color: '#1a2a4a', lineHeight: 1.6 },
  disclaimer: { fontSize: 8, color: GRAY, lineHeight: 1.5, marginBottom: 16, border: `1 solid ${BORDER}`, borderRadius: 6, padding: '10 12', backgroundColor: '#fafaf8' },
  signatureRow: { flexDirection: 'row', gap: 32, marginTop: 8 },
  signatureBlock: { flex: 1 },
  signatureLine: { borderBottom: `1 solid #999`, height: 24, marginBottom: 4 },
  signatureLabel: { fontSize: 8, color: GRAY },
  footer:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10 32', borderTop: `1 solid ${BORDER}`, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' },
  footerText: { fontSize: 7.5, color: GRAY },
  footerGold: { fontSize: 7.5, color: GOLD, fontWeight: 'bold' },
  mb16:      { marginBottom: 16 },
  mb20:      { marginBottom: 20 },
});

interface CostLineItem   { label: string; amount: number; category: string }
interface FinancingOption { type: string; label: string; totalAmount: number; downPayment?: number; monthlyPayment?: number; termMonths?: number; discountApplied?: boolean }

export interface ProposalPDFProps {
  facilityName:       string;
  facilityAddress?:   string;
  facilityPhone?:     string;
  facilityLogoUrl?:   string;
  patientName:        string;
  surgeonName:        string;
  procedureName:      string;
  proposalDate:       string;
  lineItems:          CostLineItem[];
  financingOptions:   FinancingOption[];
  selectedFinancing:  number;
  patientSummary:     string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

export function ProposalDocument({
  facilityName, facilityAddress, facilityPhone, facilityLogoUrl,
  patientName, surgeonName, procedureName, proposalDate,
  lineItems, financingOptions, selectedFinancing, patientSummary,
}: ProposalPDFProps) {
  const chosen = financingOptions[selectedFinancing];
  const total  = lineItems.reduce((s, i) => s + i.amount, 0);
  const categories = [...new Set(lineItems.map(i => i.category))];

  return (
    <Document title={`Surgical Proposal — ${patientName}`} author={facilityName}>
      <Page size="LETTER" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          {facilityLogoUrl
            ? <Image src={facilityLogoUrl} style={S.logo} />
            : <View style={S.logoPlaceholder}><Text style={{ color: '#ffffff', fontSize: 8, fontWeight: 'bold' }}>LOGO</Text></View>}
          <View>
            <Text style={S.facilityName}>{facilityName}</Text>
            {facilityAddress && <Text style={S.facilityAddr}>{facilityAddress}</Text>}
            {facilityPhone   && <Text style={S.facilityAddr}>{facilityPhone}</Text>}
          </View>
        </View>
        <View style={S.goldBar} />

        <View style={S.body}>
          <Text style={S.proposalTitle}>Surgical Proposal</Text>
          <Text style={S.proposalSubtitle}>Confidential — Prepared for {patientName}</Text>

          {/* Info cards */}
          <View style={S.infoRow}>
            <View style={S.infoCard}>
              <Text style={S.infoLabel}>Patient</Text>
              <Text style={S.infoValue}>{patientName}</Text>
            </View>
            <View style={S.infoCard}>
              <Text style={S.infoLabel}>Procedure</Text>
              <Text style={S.infoValue}>{procedureName}</Text>
            </View>
            <View style={S.infoCard}>
              <Text style={S.infoLabel}>Surgeon</Text>
              <Text style={S.infoValue}>{surgeonName}</Text>
              <Text style={S.infoSub}>Board Certified Plastic Surgeon</Text>
            </View>
            <View style={S.infoCard}>
              <Text style={S.infoLabel}>Proposal Date</Text>
              <Text style={S.infoValue}>{proposalDate}</Text>
            </View>
          </View>

          {/* Patient summary */}
          {patientSummary && (
            <View style={[S.summaryBox, S.mb20]}>
              <Text style={S.summaryText}>{patientSummary}</Text>
            </View>
          )}

          {/* Cost breakdown */}
          <Text style={S.sectionTitle}>Cost Breakdown</Text>
          <View style={S.mb16}>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderText, S.col1]}>Service / Item</Text>
              <Text style={[S.tableHeaderText, S.col2]}>Amount</Text>
            </View>
            {categories.map((cat, ci) => (
              <View key={ci}>
                {lineItems.filter(i => i.category === cat).map((item, idx) => (
                  <View key={idx} style={[S.tableRow, idx % 2 === 1 ? S.tableRowAlt : {}]}>
                    <Text style={[{ fontSize: 10, color: '#1a1a1a' }, S.col1]}>{item.label}</Text>
                    <Text style={[{ fontSize: 10, color: NAVY, fontWeight: 'bold' }, S.col2]}>{fmt(item.amount)}</Text>
                  </View>
                ))}
              </View>
            ))}
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Total Estimate</Text>
              <Text style={S.totalValue}>{fmt(total)}</Text>
            </View>
          </View>

          {/* Financing */}
          {chosen && (
            <>
              <Text style={S.sectionTitle}>Your Financing Option</Text>
              <View style={S.financingBox}>
                <Text style={S.financingTitle}>{chosen.label}</Text>
                <View style={S.financingRow}>
                  <Text style={S.financingLabel}>Total Amount</Text>
                  <Text style={S.financingValue}>{fmt(chosen.totalAmount)}</Text>
                </View>
                {chosen.downPayment != null && (
                  <View style={S.financingRow}>
                    <Text style={S.financingLabel}>Down Payment</Text>
                    <Text style={S.financingValue}>{fmt(chosen.downPayment)}</Text>
                  </View>
                )}
                {chosen.monthlyPayment != null && (
                  <View style={S.financingRow}>
                    <Text style={S.financingLabel}>Monthly Payment</Text>
                    <Text style={S.financingValue}>{fmt(chosen.monthlyPayment)} × {chosen.termMonths} months</Text>
                  </View>
                )}
                {chosen.discountApplied && (
                  <View style={S.financingRow}>
                    <Text style={S.financingLabel}>Pay-in-Full Courtesy Discount Applied</Text>
                    <Text style={{ ...S.financingValue, color: '#2ecc71' }}>✓ 5% Savings</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Disclaimer */}
          <Text style={S.sectionTitle}>Important Information</Text>
          <Text style={S.disclaimer}>
            This proposal is an estimate based on the anticipated procedure and may change based on final surgical planning,
            anesthesia duration, implant selection, or unforeseen surgical complexity. Final fees will be confirmed at your
            pre-operative appointment. This estimate is valid for 90 days from the date above. Financing options are subject
            to approval. All procedures carry inherent risks which will be discussed in detail during your consultation.
            This document does not constitute a guarantee of outcome.
          </Text>

          {/* Signature block */}
          <View style={S.signatureRow}>
            <View style={S.signatureBlock}>
              <View style={S.signatureLine} />
              <Text style={S.signatureLabel}>Patient Signature</Text>
            </View>
            <View style={S.signatureBlock}>
              <View style={S.signatureLine} />
              <Text style={S.signatureLabel}>Date</Text>
            </View>
            <View style={S.signatureBlock}>
              <View style={S.signatureLine} />
              <Text style={S.signatureLabel}>Provider / Coordinator</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={S.footer}>
          <Text style={S.footerText}>Prepared by {facilityName} · Powered by</Text>
          <Text style={S.footerGold}>PatientTrac Revela</Text>
          <Text style={S.footerText}>Confidential — For Patient Use Only</Text>
        </View>
      </Page>
    </Document>
  );
}
