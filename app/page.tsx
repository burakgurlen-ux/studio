
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, X } from 'lucide-react';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { PatientConcerns } from '@/components/landing/PatientConcerns';
import { WhyUseIt } from '@/components/landing/WhyUseIt';
import { Logo } from '@/components/ui/logo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Specialist = {
  id: string;
  uid: string;
  name?: string;
  specialty?: string;
  clinicName?: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  website?: string;
};

export default function Home() {
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();

  const [patientId, setPatientId] = useState("");
  const [pin, setPin] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Terms state
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [verifiedConsultationId, setVerifiedConsultationId] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);

  // Fetch Specialists for Search
  const specialistsQuery = useMemoFirebase(() => query(collection(db, 'specialists')), [db]);
  const { data: specialists } = useCollection<Specialist>(specialistsQuery);

  const filteredSpecialists = useMemoFirebase(() => {
    if (!searchQuery.trim() || !specialists) return [];
    const term = searchQuery.toLowerCase();
    return specialists.filter(s => 
      (s.name?.toLowerCase().includes(term)) || 
      (s.specialty?.toLowerCase().includes(term)) ||
      (s.clinicName?.toLowerCase().includes(term))
    ).slice(0, 5);
  }, [searchQuery, specialists]);

  const sendViewPin = async () => {
    const cleanId = patientId.trim();
    if (!cleanId) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a Patient ID." });
      return;
    }
    setIsLoading(true);
    try {
        const patientDocRef = doc(db, "patients", cleanId);
        const patientDocSnap = await getDoc(patientDocRef);
        if (patientDocSnap.exists()) {
            const patientData = patientDocSnap.data();
            const cleanEmail = patientData.email.trim().toLowerCase();
            const newPin = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 
            
            await updateDoc(patientDocRef, { viewPin: newPin, viewPinExpiresAt: expiresAt });
            
            await addDoc(collection(db, "mail"), {
                to: cleanEmail,
                message: {
                    subject: `Your One-Time PIN for opid`,
                    html: `<p>Hello ${patientData.name},</p><p>Your one-time PIN to view your consultation question is: <strong style={{color: '#5baae1'}}>${newPin}</strong></p><p>This PIN will expire in 10 minutes and can only be used once.</p>`,
                },
                createdAt: serverTimestamp(),
            });
            
            toast({ title: "PIN Sent", description: "A one-time PIN has been sent to your registered email address." });
            setShowPinInput(true);
        } else {
            toast({ variant: "destructive", title: "Invalid ID", description: "No patient found with that ID." });
        }
    } catch (error: any) {
        console.error(`Error sending view PIN:`, error);
        toast({ 
          variant: "destructive", 
          title: "Error", 
          description: "Could not process your request. Please try again.",
        });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleShowForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = patientId.trim();
    const cleanPin = pin.trim();

    if (!cleanId || !cleanPin) {
      toast({ variant: "destructive", title: "Error", description: "Please enter both Patient ID and PIN." });
      return;
    }

    setIsLoading(true);
    try {
      const docRef = doc(db, "patients", cleanId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
          const data = docSnap.data();
          const pinExpires = data.viewPinExpiresAt?.toDate();
          if (data.viewPin === cleanPin && pinExpires && pinExpires > new Date()) {
              if (data.latestConsultationId) {
                  // Don't push immediately, open the terms dialog
                  setVerifiedConsultationId(data.latestConsultationId);
                  setIsTermsOpen(true);
                  // Reset pin input for security
                  setPin("");
              } else {
                  toast({ variant: "destructive", title: "No Consultation", description: "No consultation question is available for this patient yet." });
              }
          } else if (data.viewPin !== cleanPin) {
              toast({ variant: "destructive", title: "Invalid PIN", description: "The PIN you entered is incorrect." });
          } else {
              toast({ variant: "destructive", title: "PIN Expired", description: "Your PIN has expired. Please request a new one." });
              setShowPinInput(false);
              setPin("");
          }
      } else {
          toast({ variant: "destructive", title: "Invalid ID", description: "No patient found with that ID." });
      }
    } catch (error) {
      console.error("Error verifying PIN:", error);
      toast({ variant: "destructive", title: "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalRedirect = async () => {
    if (!termsAccepted || !verifiedConsultationId || !patientId) return;
    
    setIsLoading(true);
    try {
        const docRef = doc(db, "patients", patientId.trim());
        // Clear the PIN after acceptance so it can't be reused
        await updateDoc(docRef, { viewPin: null, viewPinExpiresAt: null });
        router.push(`/view-consultation/${verifiedConsultationId}`);
    } catch (error) {
        console.error("Redirect error:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load the form." });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-white">
      <header className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <Logo className="text-4xl" />
          <div className="hidden md:flex items-center gap-4">
            <Button variant="link" asChild className="text-base font-bold">
                <Link href="#how-it-works">How it works</Link>
            </Button>
            <Button variant="link" asChild className="text-base font-bold">
                <Link href="#patient-concerns">Patient Concerns</Link>
            </Button>
            <Button variant="link" asChild className="text-base font-bold">
                <Link href="#why-use-it">Solutions</Link>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Search specialist, branch etc." 
                className="h-9 w-40 xl:w-64 pl-9 rounded-full bg-gray-50 border-gray-200 focus:bg-white focus:border-primary transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              />
              
              {/* Search Results Dropdown */}
              {isSearchFocused && searchQuery.trim() !== "" && (
                <div className="absolute top-full mt-2 w-full bg-white border rounded-lg shadow-xl z-50 overflow-hidden min-w-[250px]">
                  {filteredSpecialists.length > 0 ? (
                    filteredSpecialists.map(specialist => (
                      <div 
                        key={specialist.id} 
                        className="p-4 hover:bg-gray-50 cursor-pointer border-b last:border-0 flex flex-col gap-0.5"
                        onMouseDown={(e) => {
                          e.preventDefault(); 
                          setSelectedSpecialist(specialist);
                          setSearchQuery("");
                          setIsSearchFocused(false);
                        }}
                      >
                        <p className="text-sm font-bold text-gray-900">{specialist.name || 'Anonymous Specialist'}</p>
                        <p className="text-[11px] text-primary font-medium uppercase tracking-wide">{specialist.specialty || 'General'}</p>
                        {specialist.clinicName && (
                          <p className="text-[10px] text-muted-foreground italic">{specialist.clinicName}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No specialists found.
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button asChild>
                <Link href="/login">Login</Link>
            </Button>
          </div>
        </div>
      </header>
      
       <div className="flex-grow container mx-auto px-4 flex items-center py-16">
        <div className="grid md:grid-cols-2 gap-16 items-center w-full">
          <div className="text-4xl md:text-5xl lg:text-6xl text-primary font-light leading-tight">
            be
            <br />
            one step
            <br />
            ahead in
            <br />
            health tourism with
            <br />
            <span className="font-bold italic">&quot;One Patient ID&quot;</span>
          </div>

          <div className="w-full max-sm:mx-auto max-w-sm space-y-8 justify-self-center md:justify-self-center">
            <div className="text-center">
              <h1 className="text-xl text-gray-700 font-light">View Consultation Request Form</h1>
            </div>
            
            <form onSubmit={handleShowForm} className="w-full space-y-4">
                <div>
                    <Input
                        type="text"
                        placeholder="Enter Patient ID"
                        className="h-12 px-6 text-base rounded-full w-full bg-gray-100 border-primary/50 focus:bg-white focus:border-primary focus:ring-primary"
                        value={patientId}
                        onChange={(e) => setPatientId(e.target.value)}
                        readOnly={showPinInput}
                    />
                    {!showPinInput && (
                        <div className="text-right mt-2">
                            <Button 
                                type="button"
                                onClick={sendViewPin}
                                variant="ghost" 
                                className="font-bold text-primary"
                                disabled={isLoading || !patientId}
                            >
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : "OK"}
                            </Button>
                        </div>
                    )}
                </div>
                
                {showPinInput && (
                    <div>
                        <Input
                            type="password"
                            placeholder="Enter PIN from email"
                            className="h-12 px-6 text-base rounded-full w-full bg-gray-100 border-primary/50 focus:bg-white focus:border-primary focus:ring-primary"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            maxLength={6}
                        />
                         <div className="text-right mt-2">
                             <Button 
                                type="submit"
                                variant="ghost" 
                                className="font-bold text-primary"
                                disabled={isLoading || !pin}
                            >
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : "OK"}
                            </Button>
                        </div>
                    </div>
                )}
            </form>
            
            <div className="text-center flex flex-col items-center">
              <Button asChild className="bg-primary hover:bg-primary/90 rounded-md font-bold px-8 py-3 h-auto">
                <Link href="/signup">FREE REGISTER NOW</Link>
              </Button>
              <p className="text-lg text-gray-700 font-light mt-8 whitespace-nowrap">
                " Patients Feel Safe and Confident with One Patient ID "
              </p>
            </div>
          </div>
        </div>
      </div>
      <HowItWorks />
      <PatientConcerns />
      <WhyUseIt />

      {/* User Agreement Dialog for Form Viewing (Authorized Doctor Terms) */}
      <Dialog open={isTermsOpen} onOpenChange={setIsTermsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase">USAGE AGREEMENT FOR DOCTORS AUTHORIZED BY PATIENTS</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6 text-sm leading-relaxed">
            <section>
              <h3 className="font-bold text-base mb-2">1. Parties</h3>
              <ul className="list-none space-y-2">
                <li><strong>1.1.</strong> This Usage Agreement is arranged between the Doctor who accesses the "View Consultation Form" area using the login information (ID, Password, and PIN) provided by the patient with their own consent (hereinafter referred to as the "Authorized Doctor") and www.onepatientid.com (hereinafter referred to as the "Platform").</li>
                <li><strong>1.2.</strong> Every doctor logging into the Platform with this information is deemed to have read this agreement and accepted all its articles.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">2. Use of Login Information Provided by the Patient</h3>
              <ul className="list-none space-y-2">
                <li><strong>2.1.</strong> The Authorized Doctor may only use the login information provided by the patient within the framework of the patient's concrete consent and medical evaluation request.</li>
                <li><strong>2.2.</strong> Storing, copying, noting, or sharing the password and PIN information provided by the patient with third parties is strictly prohibited.</li>
                <li><strong>2.3.</strong> It is mandatory to close the session after the review process is finished. Storing login information for reuse or providing unauthorized access without the patient's knowledge constitutes a legal violation.</li>
                <li><strong>2.4.</strong> All administrative, legal, and criminal responsibility arising from the misuse or negligence of login information belongs to the Authorized Doctor.</li>
                <li><strong>2.5.</strong> The Platform cannot be held responsible for any damages arising from password sharing, unauthorized access, or the doctor's failure to protect login information.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">3. Protection of Patient Information and Confidentiality</h3>
              <ul className="list-none space-y-2">
                <li><strong>3.1.</strong> The Authorized Doctor may only view the personal and health data belonging to the patient (consultation forms, examinations, etc.) for the purpose of creating a medical opinion.</li>
                <li><strong>3.2.</strong> Data Security: No information, document, image, or record viewed on the Platform can be taken out of the platform, screenshotted, digitally or physically reproduced, or shared with third parties.</li>
                <li><strong>3.3.</strong> Archiving patient data or creating a secret database is prohibited.</li>
                <li><strong>3.4.</strong> In the event of a violation (disclosure or leak) of this data by the Authorized Doctor, all responsibility belongs to the doctor; onepatientid accepts no responsibility.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">4. Medical Evaluation and Disclaimer</h3>
              <ul className="list-none space-y-2">
                <li><strong>4.1.</strong> The data on the Platform are medical records presented over a technical infrastructure, and onepatientid has no control over the medical accuracy of this information.</li>
                <li><strong>4.2.</strong> All comments, opinions, and suggestions made by the Authorized Doctor based on the data on the Platform are only in the nature of a "second opinion/pre-assessment"; they do not replace an official medical report or examination.</li>
                <li><strong>4.3.</strong> The Authorized Doctor is personally responsible for any complications, misinformation, or medical results that may occur in the patient as a result of the evaluations made by the doctor.</li>
                <li><strong>4.4.</strong> The Platform is not a party to the professional relationship between the Authorized Doctor and the Patient and does not enter into any financial or legal obligations due to the opinions presented.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">5. Account and Access Security</h3>
              <ul className="list-none space-y-2">
                <li><strong>5.1.</strong> The Authorized Doctor is responsible for keeping the login information provided by the patient secure during their own access.</li>
                <li><strong>5.2.</strong> In the event that the device from which the doctor accesses is not secure or the passwords fall into the hands of unauthorized persons, the responsibility belongs entirely to the doctor who logs in.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">6. Limitation of Liability of the Platform</h3>
              <ul className="list-none space-y-2">
                <li><strong>6.1.</strong> The Platform is not responsible for any transactions (data viewing, deletion, change attempts, etc.) performed by the Authorized Doctor during their access to the platform.</li>
                <li><strong>6.2.</strong> The Platform does not assume any damages arising from the irregular use of patient data by the Authorized Doctor.</li>
                <li><strong>6.3.</strong> The Platform consists only of a technical intermediary, and all legal responsibility lies with the doctor using the login information.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">7. Acceptance of the Agreement</h3>
              <ul className="list-none space-y-2">
                <li>The doctor is deemed to have declared that they have read this agreement, understood onepatientid's data processing policy, and committed to complying with all articles from the moment they log into the "View Consultation Form" page on the platform.</li>
              </ul>
            </section>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row items-center gap-4 border-t pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="terms-check" 
                checked={termsAccepted} 
                onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
              />
              <Label htmlFor="terms-check" className="text-sm font-medium leading-none cursor-pointer">
                I have read and agree to the User Agreement.
              </Label>
            </div>
            <Button 
                onClick={handleFinalRedirect} 
                disabled={!termsAccepted || isLoading}
                className="w-full sm:w-auto"
            >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                View Consultation Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specialist Profile Modal (Pop-up) - Text Only */}
      <Dialog open={!!selectedSpecialist} onOpenChange={(open) => !open && setSelectedSpecialist(null)}>
        <DialogContent className="sm:max-w-[450px] p-8 border border-border shadow-2xl rounded-lg bg-white">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4 text-muted-foreground hover:bg-gray-100 rounded-full h-8 w-8"
            onClick={() => setSelectedSpecialist(null)}
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="flex flex-col space-y-8 pt-4">
            <header className="border-b pb-6">
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">{selectedSpecialist?.name}</h2>
              <p className="text-primary font-bold text-xs uppercase tracking-widest mt-2">{selectedSpecialist?.specialty}</p>
            </header>

            <div className="space-y-6">
              {selectedSpecialist?.clinicName && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Clinic Name</p>
                  <p className="text-sm font-semibold text-gray-800">{selectedSpecialist.clinicName}</p>
                </div>
              )}

              {selectedSpecialist?.email && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Email Address</p>
                  <p className="text-sm font-semibold text-gray-800">{selectedSpecialist.email}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                {(selectedSpecialist?.city || selectedSpecialist?.country) && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Location</p>
                    <p className="text-sm font-semibold text-gray-800">
                        {selectedSpecialist.city}{selectedSpecialist.city && selectedSpecialist.country ? ', ' : ''}{selectedSpecialist.country}
                    </p>
                  </div>
                )}

                {selectedSpecialist?.phone && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Phone</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedSpecialist.phone}</p>
                  </div>
                )}
              </div>

              {selectedSpecialist?.site && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Website</p>
                  <a 
                    href={selectedSpecialist.website.startsWith('http') ? selectedSpecialist.website : `https://${selectedSpecialist.website}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm font-bold text-primary hover:underline block truncate"
                  >
                    {selectedSpecialist.website}
                  </a>
                </div>
              )}
            </div>
            
            <div className="pt-4">
              <Button className="w-full h-11 text-sm font-bold rounded-md" onClick={() => setSelectedSpecialist(null)}>
                Close Profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
