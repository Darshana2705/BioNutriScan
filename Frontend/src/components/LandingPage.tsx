import React, { useState } from 'react';
import './LandingPage.css';

interface LandingPageProps {
    onStart: () => void;
    backendURL?: string;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);

    const handleRunClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        onStart();
    };

    return (
        <div className="landing-page">
            <div className="background-blobs">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
            </div>

            <div className="lp-container">
                <nav>
                    <div className="logo">
                        <div className="logo-box">B</div>
                        BioNutriScan
                    </div>
                    <div className="nav-links">
                        <a href="#features">Features</a>
                        <a href="#protocol">Analysis Protocol</a>
                        <a href="#architecture">System Architecture</a>
                        <a href="#research">Research</a>
                    </div>
                </nav>

                <main className="hero">
                    <div className="badge">Final Year Project</div>
                    <h1>A Clinical Decision Support System for<br /><span>Vitamin Deficiency Assessment</span></h1>
                    <p>
                        An affordable, non-invasive alternative to traditional blood tests. BioNutriScan uses deep learning (EfficientNetV2) and multimodal AI to identify 14+ vitamin deficiencies from visual indicators on skin, tongue, eyes, and nails.
                    </p>

                    <a href="/app" className="lp-btn" id="runBtn" onClick={handleRunClick}>
                        Launch Application
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </a>

                    <div className="stats">
                        <div className="stat-item">
                            <div className="stat-value"><span>92.1%</span></div>
                            <div className="stat-label">Overall Accuracy</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value"><span>18.3k</span></div>
                            <div className="stat-label">Images Trained</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">89</div>
                            <div className="stat-label">Skin Classes</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">&lt;3<span>s</span></div>
                            <div className="stat-label">Response Time</div>
                        </div>
                    </div>
                </main>

                <section id="features">
                    <div className="section-header">
                        <h2>Dual-Layer Diagnostic Approach</h2>
                        <p>Combining custom Convolutional Neural Networks with Clinical Large Language Models to achieve expert-level diagnostic precision.</p>
                    </div><br />
                    <div className="grid-3">
                        <div className="card">
                            <div className="card-icon">🧠</div>
                            <h3>CNN Classification</h3>
                            <p>Powered by EfficientNetV2 using transfer learning from ImageNet. Evaluates spatial features with 94.49% standalone accuracy on dermatological manifestations.</p>
                        </div>
                        <div className="card">
                            <div className="card-icon">👁️</div>
                            <h3>AI Clinical Assessment</h3>
                            <p>Integrates multimodal Large Language Models for detailed visual examination based on established dermatological assessment protocols.</p>
                        </div>
                        <div className="card">
                            <div className="card-icon">🔄</div>
                            <h3>Result Fusion & Deduplication</h3>
                            <p>Algorithmically merges ML and AI results, weighting primary indicators and discarding false positives to provide the single most probable clinical diagnosis.</p>
                        </div>
                        <div className="card">
                            <div className="card-icon">📊</div>
                            <h3>Cross-Verification Module</h3>
                            <p>Leverages historical feedback data to refine prediction confidence over time. Demonstrated accuracy gains up to 7.2% through continuous learning.</p>
                        </div>
                        <div className="card">
                            <div className="card-icon">🥦</div>
                            <h3>Evidence-Based Guidance</h3>
                            <p>Generates personalized dietary recommendations and age-adjusted supplement dosage multipliers based on the final unified assessment.</p>
                        </div>
                        <div className="card">
                            <div className="card-icon">📱</div>
                            <h3>Accessible Health</h3>
                            <p>Designed for deployment in resource-constrained environments, rural areas, and primary care settings using standard smartphone cameras.</p>
                        </div>
                    </div>
                </section>

                <section id="protocol">
                    <div className="section-header">
                        <h2>Clinical Analysis Protocol</h2>
                        <p>A systematic step-by-step evaluation mirroring traditional dermatological inspection.</p>
                    </div>
<br />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px', margin: '0 auto' }}>
                        <div className="card" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                            <div style={{ background: 'var(--primary)', color: 'var(--bg)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0, fontSize: '1.2rem' }}>1</div>
                            <div>
                                <h3 style={{ marginBottom: '0.5rem' }}>Health Status Assessment</h3>
                                <p>The system first evaluates basic skin health: clarity, texture uniformity, and absence of lesions. If the presentation is normal, the analysis terminates early to strictly prevent false positives.</p>
                            </div>
                        </div>
                        <div className="card" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                            <div style={{ background: 'var(--primary)', color: 'var(--bg)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0, fontSize: '1.2rem' }}>2</div>
                            <div>
                                <h3 style={{ marginBottom: '0.5rem' }}>Systematic Deficiency Analysis</h3>
                                <p>For abnormal cases, AI performs a surface analysis (detecting petechiae, purpura, ecchymoses) and regional assessment of the face, extremities, mucous membranes, and sun-exposed areas.</p>
                            </div>
                        </div>
                        <div className="card" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                            <div style={{ background: 'var(--primary)', color: 'var(--bg)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0, fontSize: '1.2rem' }}>3</div>
                            <div>
                                <h3 style={{ marginBottom: '0.5rem' }}>Pattern Recognition & Confidence Scoring</h3>
                                <p>Identification of patterns like Bleeding (Vit C/K), Dry/rough skin (Vit A), Pallor (Iron/B12), and Photosensitive (Niacin). Confidence scores are dynamically calculated based on the severity and number of clinical signs.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="architecture">
                    <div className="architecture">
                        <div className="section-header" style={{ marginBottom: '2rem' }}>
                            <h2>Three-Tier Architecture</h2>
                            <p>Built for scalability, modularity, and resource-constrained environments.</p>
                        </div>
                        <div className="arch-layers">
                            <div className="arch-layer">
                                <div className="layer-name">Client Layer</div>
                                <div className="layer-details">
                                    <h4>Presentation & Interaction</h4>
                                    <p>React-based interface for image upload, real-time result visualization, comprehensive report generation, and feedback submission.</p>
                                    <div className="layer-tags">
                                        <span className="layer-tag">React JS</span>
                                        <span className="layer-tag">Image Preprocessing</span>
                                        <span className="layer-tag">Report Generation</span>
                                    </div>
                                </div>
                            </div>
                            <div className="arch-layer">
                                <div className="layer-name">Application Layer</div>
                                <div className="layer-details">
                                    <h4>Core Diagnostic Logic</h4>
                                    <p>Flask backend coordinating the parallel analysis between the ML Service (CNN) and AI Service (LLM), and executing the deduplication algorithm.</p>
                                    <div className="layer-tags">
                                        <span className="layer-tag">Flask Server</span>
                                        <span className="layer-tag">Result Fusion Engine</span>
                                        <span className="layer-tag">Recommendation Engine</span>
                                    </div>
                                </div>
                            </div>
                            <div className="arch-layer">
                                <div className="layer-name">Data Layer</div>
                                <div className="layer-details">
                                    <h4>Storage & Inference</h4>
                                    <p>Hosting the trained .h5 models, JSON image persistence for historical accuracy tracking, and integrations with external multimodal AI APIs.</p>
                                    <div className="layer-tags">
                                        <span className="layer-tag">EfficientNetV2 (.h5)</span>
                                        <span className="layer-tag">Feedback Storage</span>
                                        <span className="layer-tag">External LLM API</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            </div>

            <section className="team-section" id="research">
                <div className="lp-container">
                    <div className="section-header" style={{ marginBottom: '2rem' }}>
                        <h2>Research Team</h2>
                        <p>Computer Science and Technology, UMIT</p>
                    </div>
                    <div className="authors">
                        <div className="author">
                            <div className="author-name">Darshana Barhate</div>
                            <div className="author-uni">darshanabarhate@gmail.com</div>
                        </div>
                        <div className="author">
                            <div className="author-name">Mansi Ahire</div>
                            <div className="author-uni">mansiahire31@gmail.com</div>
                        </div>
                        <div className="author">
                            <div className="author-name">Mrunal Gaikwad</div>
                            <div className="author-uni">mrunalgaikwad2364@gmail.com</div>
                        </div>
                    </div>
                    <div className="authors" style={{ marginTop: '2rem' }}>
                        <div className="author">
                            <div className="author-name">Monica Charate</div>
                            <div className="author-role">Assistant Professor / Supervisor</div>
                            <div className="author-uni">monica.charate1983@gmail.com</div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="lp-container">
                <footer>
                    &copy; 2025 BioNutriScan - A Clinical Decision Support System.<br />
                    <span style={{ opacity: 0.5, fontSize: '0.8rem', display: 'block', marginTop: '10px' }}>For demonstration and preliminary screening only. Does not replace professional medical advice.</span>
                    <div className="footer-links">
                        <a onClick={(e) => { e.preventDefault(); setShowTerms(true); }}>Terms & Conditions</a>
                        <a onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }}>Privacy Policy</a>
                    </div>
                </footer>
            </div>

            {showTerms && (
                <div className="modal-overlay" onClick={() => setShowTerms(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowTerms(false)}>&times;</button>
                        <h2>Terms and Conditions</h2>
                  

                        <h3>1. Introduction and Acceptance of Terms</h3>
                        <p>Welcome to BioNutriScan, a clinical decision support system developed by the Research Division at UMIT — University for Health Sciences, Medical Informatics and Technology. These Terms and Conditions (“Terms”) constitute a legally binding agreement between you (“User”) and UMIT (“We,” “Us,” or “Our”).</p>
                        <p>By accessing, registering for, or using this system in any capacity — including but not limited to uploading images, viewing results, or utilizing the cross-verification module — you confirm that you have read, understood, and agree to be bound by these Terms in their entirety, along with our Privacy Policy (attached herein).</p>
                        <p>If you do not agree to any provision of these Terms, you must immediately discontinue all use of the system. Use of this system constitutes your ongoing acceptance of these Terms.</p>

                        <h3>2. Medical Disclaimer and Clinical Limitations</h3>
                        <p><strong>IMPORTANT: BioNutriScan is NOT a licensed medical device. Its outputs must never be used as the sole basis for any clinical decision. Always consult a qualified healthcare professional.</strong></p>
                        <p>BioNutriScan is designed exclusively for demonstration, academic research, and preliminary screening assistance purposes. It has not been reviewed, approved, or certified by any regulatory body as a medical device or clinical diagnostic tool. Specifically:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li>BioNutriScan does not diagnose, treat, cure, or prevent any disease, medical condition, or health disorder.</li>
                            <li>The system’s outputs represent probabilistic estimates generated by AI models and are inherently subject to error, bias, and uncertainty.</li>
                            <li>Results should always be interpreted alongside formal clinical examination, laboratory testing, and standard diagnostic procedures by a licensed healthcare professional.</li>
                            <li>The accuracy of outputs is directly dependent on the quality, lighting, resolution, and clinical relevance of submitted images.</li>
                            <li>The system may perform differently across patient populations, skin tones, and clinical presentations not well-represented in the training dataset.</li>
                            <li>Always seek the advice of a licensed physician, dermatologist, nutritionist, or other qualified health professional before acting on any result produced by this system.</li>
                            <li>In the event of a medical emergency, contact your local emergency services immediately and do not rely on this system.</li>
                        </ul>

                        <h3>3. Permitted and Prohibited Use</h3>
                        <p>You are granted a limited, non-exclusive, non-transferable, revocable license to use BioNutriScan strictly for academic research, educational, and non-commercial screening assistance purposes.</p>
                        <p>You expressly agree NOT to use this system to:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li>Provide, market, or represent BioNutriScan outputs as certified medical diagnoses in any clinical, legal, administrative, or commercial context.</li>
                            <li>Upload images belonging to third parties without their explicit, documented, and informed consent.</li>
                            <li>Upload or process images of minors (persons under 18 years of age) without verifiable parental or legal guardian consent.</li>
                            <li>Attempt to reverse-engineer, decompile, extract, copy, or reproduce the underlying AI models, including the EfficientNetV2 classification pipeline or associated Large Language Models.</li>
                            <li>Circumvent, disable, or interfere with any security feature, authentication mechanism, or access control of the platform.</li>
                            <li>Introduce malicious code, bots, crawlers, or automated scripts that could disrupt system performance or data integrity.</li>
                            <li>Use the system in any jurisdiction where such use may violate applicable law or regulation.</li>
                            <li>Commercially exploit, sublicense, resell, or transfer access to BioNutriScan to third parties without prior written authorization from UMIT.</li>
                        </ul>
                        <p>Violation of these provisions may result in immediate and permanent termination of your access and may subject you to civil and/or criminal liability under applicable law.</p>

                        <h3>4. Accuracy, Performance, and Limitation of Liability</h3>
                        <p>The AI models powering BioNutriScan have been trained and internally validated on curated research datasets. Despite rigorous development standards, real-world clinical performance may vary significantly due to factors including image quality, patient-specific variables, and inherent limitations of machine learning models.</p>
                        <p>To the maximum extent permitted by applicable law, UMIT and the BioNutriScan research team:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li>Make no warranty, express or implied, regarding the completeness, accuracy, reliability, suitability, or fitness for a particular purpose of any system output.</li>
                            <li>Shall not be liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including but not limited to: loss of life, personal injury, misdiagnosis, treatment errors, loss of data, or financial loss) arising from your use of or reliance on the system.</li>
                            <li>Are not responsible for clinical decisions made by healthcare professionals, patients, or any third party based on system outputs.</li>
                            <li>Do not guarantee uninterrupted, error-free, or secure access to the system at all times.</li>
                        </ul>
                        <p>You assume full responsibility for evaluating and acting upon any information provided by BioNutriScan. Your use of this system is entirely at your own risk.</p>

                        <h3>5. Intellectual Property Rights</h3>
                        <p>All components of BioNutriScan, including but not limited to the software architecture, model weights, training pipelines, algorithms, user interface, API design, documentation, research outputs, and visual design, are the exclusive intellectual property of UMIT and the contributing research team members, protected under applicable copyright, patent, trade secret, and intellectual property laws.</p>
                        <p>This includes specifically:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li>The EfficientNetV2-based image classification and feature extraction pipeline.</li>
                            <li>The Clinical Large Language Model (LLM) integration and prompt engineering framework.</li>
                            <li>The cross-verification and confidence calibration module.</li>
                            <li>All training datasets curated, annotated, or generated by the UMIT research team.</li>
                            <li>The BioNutriScan name, logo, and associated brand identity.</li>
                        </ul>
                        <p>Any unauthorized reproduction, distribution, modification, reverse engineering, or commercial exploitation of any component of this system is strictly prohibited and constitutes infringement of UMIT’s intellectual property rights.</p>

                        <h3>6. Data Responsibilities and User Obligations</h3>
                        <p>You acknowledge and accept the following responsibilities when using BioNutriScan:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li>You are solely responsible for ensuring that any images you upload are appropriate, legally obtained, and submitted with the knowledge and consent of all individuals depicted.</li>
                            <li>You must not upload images containing identifying information (e.g., faces, tattoos, or visible ID documents) unless absolutely necessary for the analysis and consented to by the depicted individual.</li>
                            <li>You agree to use system outputs responsibly and in accordance with applicable professional, ethical, and legal standards in your jurisdiction.</li>
                            <li>You are responsible for maintaining the confidentiality of any account credentials associated with your use of this system.</li>
                        </ul>

                        <h3>7. Termination, Suspension, and Modifications</h3>
                        <p>UMIT reserves the right, at its sole discretion, to suspend or permanently terminate your access to BioNutriScan at any time and for any reason, including but not limited to: violation of these Terms, conduct harmful to the integrity of the system or other users, or institutional policy changes.</p>
                        <p>UMIT also reserves the right to modify, update, or discontinue any feature or the entire system at any time without prior notice. Such modifications will be effective immediately upon posting.</p>
                        <p>UMIT further reserves the right to amend these Terms at any time. Continued use of the system following the posting of revised Terms constitutes your acceptance of those changes. Users are encouraged to review these Terms periodically. For questions or notices, contact the research team at: bionnutriscan-research@umit.at</p>

                        <h3>8. Governing Law and Dispute Resolution</h3>
                        <p>These Terms shall be governed by and construed in accordance with the laws of Austria, without regard to conflict of law principles. Any disputes arising from or relating to these Terms or your use of BioNutriScan shall be subject to the exclusive jurisdiction of the competent courts of Hall in Tirol, Austria.</p>
                        <p>If any provision of these Terms is found to be unlawful, void, or unenforceable, that provision shall be deemed severable and shall not affect the validity and enforceability of the remaining provisions.</p>
                    </div>
                </div>
            )}

            {showPrivacy && (
                <div className="modal-overlay" onClick={() => setShowPrivacy(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowPrivacy(false)}>&times;</button>
                        <h2>Privacy Policy</h2>

                        <h3>1. Overview and Scope</h3>
                        <p>This Privacy Policy is aligned with the General Data Protection Regulation (GDPR), the Austrian Data Protection Act (DSG), and Health Insurance Portability and Accountability Act (HIPAA) principles, to the extent applicable to research software.</p>
                        <p>This Privacy Policy explains how UMIT and the BioNutriScan research team (“We,” “Us,” “Our”) collect, process, store, and protect information submitted through the BioNutriScan Clinical Decision Support System. This policy applies to all users of the platform, including clinicians, researchers, and individuals accessing the tool for screening purposes.</p>
                        <p>By using BioNutriScan, you consent to the data practices described in this policy. If you are accessing this system on behalf of an institution or organization, you represent that you have authority to bind that organization to this policy.</p>

                        <h3>2. Data We Collect</h3>
                        <p>BioNutriScan is designed with a privacy-first, data-minimization approach. We collect only what is necessary to operate the system:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li><strong>Images uploaded:</strong> Dermatological or clinical photographs submitted for vitamin deficiency analysis. Processed transiently; not linked to PII unless you explicitly provide it.</li>
                            <li><strong>Usage metadata:</strong> Non-identifiable session metadata: browser type, screen resolution, interaction timestamps. Used for system diagnostics and performance optimization only.</li>
                            <li><strong>Feedback data:</strong> (Optional, consent-required) Anonymized image-label pairs and feedback responses retained for model improvement only if you opt in via the cross-verification module.</li>
                            <li><strong>Contact info:</strong> (Optional) If you contact the research team, any provided email address is used solely to respond to your inquiry and is not retained beyond that purpose.</li>
                        </ul>
                        <p>We do not require you to submit your name, date of birth, national identification number, address, or medical history to access the core screening functionality. We do not collect payment information.</p>

                        <h3>3. Image Processing and Storage</h3>
                        <p>All images submitted to BioNutriScan pass through the following processing pipeline:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li><strong>Metadata stripping:</strong> All EXIF metadata (including GPS coordinates, device identifiers, camera model, and embedded timestamps) is automatically and permanently stripped from uploaded images prior to any processing or storage.</li>
                            <li><strong>Transient processing (default):</strong> Images are processed in-memory by the EfficientNetV2 classification model and immediately discarded after analysis results are returned to the user. No disk write occurs unless you have explicitly opted into the feedback/training module.</li>
                            <li><strong>Optional retention (consent-required):</strong> If you actively consent to model improvement through the cross-verification module, images are stored in an encrypted, access-controlled research database under an anonymized session identifier with no linkage to personally identifiable information.</li>
                            <li><strong>Encryption standards:</strong> All data stored at rest is encrypted using AES-256. All data transmitted between your browser and our servers is encrypted using TLS 1.3 or higher. No unencrypted copies of images are retained at any point in the pipeline.</li>
                            <li><strong>Access controls:</strong> Database access is restricted to authorized UMIT research personnel only. All access events are logged and audited on a quarterly basis.</li>
                        </ul>

                        <h3>4. Third-Party API Services</h3>
                        <p>External LLM services are used for secondary analysis. All transmissions are anonymized, EXIF-stripped, and encrypted. Third-party providers are contractually bound not to retain data beyond the immediate request.</p>
                        <p>BioNutriScan utilizes external API services for its secondary analysis layer, specifically Clinical Large Language Models (LLMs) for contextual interpretation of classification results. When your image is submitted for LLM-based cross-verification, the following safeguards apply:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li>All EXIF metadata is stripped prior to any API transmission (see Section 3).</li>
                            <li>Images and associated data are transmitted via encrypted channels using TLS 1.3 or higher.</li>
                            <li>Third-party API providers are contractually bound via Data Processing Agreements (DPAs) to not store, train on, log, or retain any data transmitted from BioNutriScan beyond the immediate request-response cycle.</li>
                            <li>No personally identifiable information is included in API payloads under any circumstances.</li>
                            <li>Users may disable LLM-based cross-verification at any time via the system settings panel to limit third-party data exposure while retaining core classification functionality.</li>
                        </ul>
                        <p>UMIT is not responsible for the independent privacy practices of third-party API providers beyond the scope of the contractual obligations described above.</p>

                        <h3>5. Your Rights and Choices</h3>
                        <p>Under applicable data protection laws, including the GDPR and Austrian DSG, you hold the following rights with respect to any data you submit or that we process:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li><strong>Right to withdraw consent:</strong> You may opt out of the cross-verification feedback module at any time through the system settings, without affecting your access to the core screening features. Withdrawal of consent does not affect the lawfulness of processing prior to withdrawal.</li>
                            <li><strong>Right of access:</strong> You may request confirmation of what, if any, anonymized data associated with your session is held by UMIT, and obtain a copy of it.</li>
                            <li><strong>Right to rectification:</strong> If you believe any data associated with you is inaccurate or incomplete, you may request its correction.</li>
                            <li><strong>Right to erasure (‘Right to be Forgotten’):</strong> You may request deletion of any data that can reasonably be linked to your session. Note that purely anonymized data that cannot be linked back to you cannot be subject to erasure requests.</li>
                            <li><strong>Right to restriction of processing:</strong> You may request that we restrict processing of your data while a complaint or verification is in progress.</li>
                            <li><strong>Right to data portability:</strong> Where technically feasible, you may request a machine-readable copy of any personal data you have provided.</li>
                            <li><strong>Right to object:</strong> You may object to processing of your data for research or model training purposes at any time.</li>
                            <li><strong>Right to lodge a complaint:</strong> If you believe your data rights have been violated, you have the right to lodge a complaint with the Austrian Data Protection Authority (Datenschutzbehörde) or your national supervisory authority.</li>
                        </ul>
                        <p>To exercise any of the above rights, please contact the research team at: bionnutriscan-research@umit.at. We will respond to all verified data rights requests within 30 days, consistent with applicable legal requirements.</p>

                        <h3>6. Data Retention Periods</h3>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li><strong>Transiently processed images:</strong> Session duration only (seconds). Not persisted to disk or database.</li>
                            <li><strong>Anonymized images (opt-in):</strong> Duration of active research project. Permanently deleted or further anonymized upon project closure per UMIT data governance policy.</li>
                            <li><strong>Usage metadata logs:</strong> Maximum 90 days for diagnostic purposes, then permanently purged.</li>
                            <li><strong>Contact correspondence:</strong> Up to 12 months following resolution of inquiry, then deleted.</li>
                            <li><strong>Consent records:</strong> Retained for 5 years after withdrawal to demonstrate compliance with applicable law.</li>
                        </ul>

                        <h3>7. Security Measures</h3>
                        <p>UMIT employs the following technical and organizational security measures to protect data:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                            <li>End-to-end encryption using TLS 1.3 for all data in transit.</li>
                            <li>AES-256 encryption for all data at rest in the research database.</li>
                            <li>Role-based access control (RBAC) limiting database access to authorized personnel.</li>
                            <li>Quarterly security audits and access log reviews by the UMIT IT Security team.</li>
                            <li>Automated intrusion detection and alerting systems.</li>
                            <li>Data breach notification procedures in compliance with GDPR Article 33 (72-hour regulatory notification) and Article 34 (user notification where applicable).</li>
                        </ul>

                        <h3>8. Contact and Data Protection Officer</h3>
                        <p>For any privacy-related inquiries, data rights requests, or concerns regarding this Privacy Policy, please contact:</p>
                        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: 'var(--text-dim)', listStyle: 'none', paddingLeft: 0 }}>
                            <li><strong>Research Team Email:</strong> bionnutriscan-research@umit.at</li>
                            <li><strong>Institution:</strong> UMIT – University for Health Sciences, Medical Informatics and Technology</li>
                            <li><strong>Address:</strong> Eduard-Wallnoefer-Zentrum 1, 6060 Hall in Tirol, Austria</li>
                            <li><strong>DPO Contact:</strong> datenschutz@umit.at</li>
                            <li><strong>Supervisory Authority:</strong> Austrian Data Protection Authority (Datenschutzbehörde)</li>
                        </ul>
                        <p>This Privacy Policy was last updated on June 15, 2025. UMIT reserves the right to update this policy at any time. Material changes will be communicated via a notice on the BioNutriScan platform. Continued use of the system following such notice constitutes acceptance of the revised policy.</p>
                    </div>
                </div>
            )}

</div>
    );
};

export default LandingPage;