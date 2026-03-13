import os

# Create a test directory
os.makedirs("test_policies", exist_ok=True)

# Generate 3 dummy PDFs with basic text using ReportLab (if available) or raw PDF structure
def create_raw_pdf(filename, text_content):
    pdf = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length {len(text_content) + 55} >>
stream
BT
/F1 24 Tf
100 700 Td
({text_content}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000361 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
449
%%EOF
"""
    with open(filename, "wb") as f:
        f.write(pdf.encode('latin-1'))

create_raw_pdf("test_policies/dummy_health_policy_1.pdf", "Health Insurance Policy 1. Coverage: 500000 INR.")
create_raw_pdf("test_policies/dummy_health_policy_2.pdf", "Health Insurance Policy 2. Premium: 15000 INR per year.")
create_raw_pdf("test_policies/dummy_health_policy_3.pdf", "Health Insurance Policy 3. Insurer: Star Health. Room Rent Capping: 1%.")
print("Created 3 dummy PDFs in test_policies/")
