# Concord Guide: in-app tutorials (Spec)

Status: **Implemented** (clinical wording awaits sign-off)
Date: 2026-11-23
Builds on: [Spec v2](2026-11-14-v2-postgres-matching-ux-spec.md) and the safety rules in [Spec v1](2026-11-14-heart-compatibility-spec.md) §3.
Prototype: https://claude.ai/artifact/Wf7wKQuT7jkq3izVCdnCx4 (private). Illustration: [guide/doctor.svg](guide/doctor.svg).

## 1. Goal

Operators learn every job in Concord on the real screens, in easy words, without any risk to shared data.

- A card in the sidebar opens a dialog that lists all tutorials.
- 17 tutorials, 105 steps, built on driver.js. Together they cover every page.
- No tutorial saves, deletes, publishes, imports or resets anything.

Decisions confirmed with the owner: the design in the prototype; the sidebar card and dialog; tutorials for the whole app; easy language with full explanations; a doctor image in the dialog; calm focus effects; the shadcn scrollbar in the whole app.

Not included: tutorial progress that follows a user to another computer, video, badges, hints on every page.

## 2. What the user sees

**Sidebar card** (`AppSidebar`, above the footer, also in the mobile sheet). It shows the closing heart with the average progress, "Concord Guide", "3 of 17 finished", one sentence and the button **Open Guide**.

**Guide dialog** (shadcn `Dialog`, up to 920 px wide, full screen below 760 px).
- Header: title, one friendly paragraph, number of finished tutorials, the doctor illustration at the right.
- Search box over the title, description, keywords and step titles.
- One suggestion: the paused tutorial; otherwise "Your first match" until it is finished; otherwise the tutorial for the current page.
- Tutorials in five groups. Each row has a heart that shows progress, the name, a description, and "9 steps, 3 min", "Resume step 4" or "Finished".
- The list scrolls in `ScrollArea`. Header, search and footer stay in place.

**Welcome card**, once for each user after the first sign-in: start "Your first match", or close it. It never opens again by itself.

**Tutorial step** (driver.js popover): the heart with progress, "Step 3 of 9", the label "Practice, not saved" on practice screens, a title, the text, an optional "try it" row, and Back and Next.
- A step with a "try it" row keeps Next grey until it is done. Pressing Next early shakes the card gently and says what to do.
- Esc and × pause. A press on the dimmed page does nothing. A message offers Resume and All tutorials.
- The last step finishes the tutorial. "Your first match" ends with a closing card. Others end with a message that offers the next tutorial.
- Below 640 px the card is docked to the bottom of the screen (to the top when it points at the sidebar card).

**The closing heart**: the two halves of the Concord mark draw in and move together with progress, and meet when finished. Reduced motion turns the movement off.

## 3. Language rules

- Easy words and full sentences. No buzz words, idioms, slogans or clever titles.
- A step may use two to four sentences, up to 80 words. Do not shorten an explanation if that makes it harder to understand.
- Explain a medical word or abbreviation where it first appears in each tutorial that needs it.
- Say what the thing is, what to do, and what happens next.
- Use the labels that are on the screen. The v2 wording rules apply: never "evaluation", never "Fictional" in demo data.
- Section 11 is the text. Clinical explanations need a clinician's sign-off before release.

## 4. Safety

- Steps without a "try it" row block interaction with the highlighted element (`disableActiveInteraction`).
- "Try it" rows only change local screen state: a search, a filter, a tab, a menu, or a value on a practice screen.
- Practice screens never call a server function that writes. Save buttons are disabled and say "Practice: saving is off".
- `UnsavedGuard` is off on practice screens, and leaving one discards everything.
- A dashed banner on practice screens says "Practice screen. Synthetic records. Nothing here is saved."

## 5. Screens

**Real pages, used as they are:** `/`, `/patients`, `/donors`, `/matching`, `/matches`, `/criteria`, `/audit`, `/data`. A step that points at a table row is skipped when there is no row (`skipMissingElement`). The run indicator step ("When Concord is working") shows a sample indicator if no run is active.

**Practice screens**, which need records that may not exist:

| Screen | Route | Content |
|---|---|---|
| Check a pair | `/matches/check?practice=true` | Maya Chen and AHFK214, read-only picker, live engine |
| Add patient, Add donor | `/patients/new?practice=true`, `/donors/new?practice=true` | The real forms, Save off |
| Patient record, donor record | `/practice/patient`, `/practice/donor` | Real record components with demo records |
| Match run, match result | `/practice/run`, `/practice/result` | Real table, `ResultView` and `DecisionPanel` with demo results |

Practice data comes from `src/domain/demo-data` and `evaluate()`, loaded with a dynamic import so it is not in the initial bundle. These routes need a signed-in user like every other page. Links inside practice screens are covered by the tutorial and never lead to a missing record. Opening a practice route without a running tutorial shows the banner and a button back to the dashboard.

Components that fetch or write today get a small change so they can be drawn from props: `LatestRunCard` (split the view from the query), `PairPicker` (read-only variant), `DecisionForm`, `PatientForm` and `DonorForm` (a `practice` prop that turns saving off).

## 6. Code

New folder `src/features/guide/`:

| File | Purpose |
|---|---|
| `guide.types.ts` | `Tutorial`, `Step` |
| `tutorials/*.ts` | One file for each group. Data only |
| `practice.ts` | Demo records and results for the practice screens, worked out by the engine |
| `guide-runner.ts` | Wraps driver.js: prepare a step (route, state, scroll), wait for the target, check that "try it" is done, pause, finish |
| `guide-progress.ts` | Read and write progress in local storage, key `concord-guide:<user id>`, every access in try/catch |
| `guide-store.ts`, `components/guide-root.tsx` | Small store; mounts the lazy dialog and welcome card in `AppShell` |
| `components/` | `guide-card`, `guide-dialog`, `guide-welcome`, `closing-heart`, `doctor` |
| `guide.css` | driver.js skin from theme tokens, light and dark |

- `driver.js` pinned to `1.14.0`. Runner, tutorials, dialog and CSS load on first use. The initial bundle grows only by the card.
- Targets use `data-guide="…"` attributes or stable ids and labels, never class names. All screen state a step needs is in the URL.
- Navigation uses the router and then `waitForElement`. A target that never appears shows the step centered instead of stopping the tutorial.
- "Try it" rows are drawn and checked by the runner: a press on a target, or a check that is polled while the step is open. Next uses `nudge()`. Open select lists are listed in `allowedElements`.
- Step 8 of "Your first match" builds its text from the live result (PASS, REVIEW or FAIL, time or distance).

## 7. Scrollbars in the whole app

Every visible scrollbar is the shadcn `ScrollArea`. No browser scrollbar is visible on any page.

- `AppShell` becomes a frame with `h-dvh`. The main column and the sidebar scroll inside `ScrollArea`. The sign-in page does too.
- Router: `data-scroll-restoration-id` on the main viewport, and `scrollToTopSelectors` so a new page starts at the top. The main viewport takes focus after navigation, so the Space and Page keys keep working.
- `ScrollArea` gets optional props for the viewport (ref, id, class) and for a horizontal bar.
- `sticky` elements, hash links, `scrollIntoView` and the form scroll spy are checked again inside the new viewport. The scroll spy gets the viewport as its observer root.
- Move these to `ScrollArea`: `run-history-table`, `audit`, `match-table`, `missing-data-table`, `side-by-side`, `criteria-diff`, the publish dialog in `criteria-form`, `donor-table`, `patient-table`, `screening-results`, and both side columns of `form-layout`.
- shadcn files: `table` uses the component. Popup lists follow shadcn: no bar, with scroll arrows (`select`) or a fade at the edges (`combobox`, `command`).
- Textareas keep their own scrolling and get the same thin look with CSS, because a textarea cannot sit in a scroll area viewport.

## 8. Focus effects in the whole app

- Border, ring and outline changes fade over 180 ms. This covers the global `:focus-visible` rule in `styles.css` and the shared input, textarea, select, input group and button components, whose transitions leave out `box-shadow` today.
- Opening the Guide dialog moves focus to the dialog itself, not to the search box, so no ring appears at once.
- A focused step card shows no ring. Its buttons do when reached with the keyboard.
- Focus always stays visible for keyboard users and passes WCAG 2.4.7. With reduced motion the changes are instant.

## 9. Tests

- Unit: unique ids; every step has a title and text of 80 words or fewer; no forbidden words; every sidebar route is covered; progress survives damaged storage; search finds by keyword.
- Unit: the practice pair is REVIEW with blank inputs, PASS with 180/40/90/60, and FAIL with 300 minutes of transport. This fails if a rule change breaks the lesson.
- Source check: every `data-guide` target named in a step exists in the code.
- Browser walk of all steps at 1360 px and 390 px: the target is found and visible, the card is on screen and does not cover it, no page errors, and no write request is sent.
- `typecheck`, `lint`, `test`, `test:db` and `check:bundle` pass.

## 10. Delivery order

1. Scrollbars and focus effects (they change the frame that the Guide sits in).
2. Guide core: runner, progress, card, dialog, welcome, doctor.
3. Practice screens.
4. Tutorials, group by group, with `data-guide` targets.
5. Browser walk, dark theme and phone checks.

## 11. Tutorial text

Generated from `src/features/guide/tutorials`, which is the source of truth.

### Start here

#### Your first match (`first`)

Check one patient with one donor, from start to finish.

1. **This is the Dashboard** (/). It is the first page you see. The cards count the patients who are waiting for a heart and the donors whose hearts are available. **Pending decisions** counts the results that still need a decision from a clinician.
2. **Concord compares records for you** (/). When you add a patient, Concord compares that patient with every available donor. When you add a donor, it compares that donor with every patient who is active on the waiting list. The newest results are listed here.
3. **Let us check one pair together** (/). A pair means one patient and one donor. We will use practice records that are made up, so you can press anything without causing harm.
   - Try: Press **Check a pair**.
   - If Next is pressed too early: Please press the Check a pair button that is highlighted.
4. **The patient and the donor** (/matches/check, practice). On the left is Maya Chen, a patient waiting for a heart. On the right is a donor with the ID AHFK214. Both have blood type O. In your daily work you search for them in these two boxes. For this practice they are already chosen.
5. **The result and its six checks** (/matches/check, practice). Concord does six checks on every pair. Each small box below is one check. The overall result is the most serious of the six, so one FAIL makes the whole pair FAIL. PASS: Nothing needs attention. REVIEW: A clinician must look at this. FAIL: A value is outside the limit.
6. **Why this pair is REVIEW** (/matches/check, practice). Four values are not filled in yet, so Concord cannot finish the last check. Concord never guesses a missing value and never treats it as normal. It asks a person to look, and that is what REVIEW means here.
7. **Fill in the four values** (/matches/check, practice). The distance is in nautical miles (NM). The other three are times in minutes. You can type 180, 40, 90 and 60. You can also try your own numbers to see what happens.
   - When done: All four are filled in. Press Next to see what changed.
   - If Next is pressed too early: Please fill in all four boxes first.
8. Text depends on the values typed (/matches/check, practice):
   - **REVIEW became PASS**. The three times add up to **190 minutes**. This is the estimated cold ischemic time. It means how long the heart is expected to be without blood flow. Up to 240 minutes is a PASS, so the result changed from REVIEW to PASS while you typed.
   - **The pair is still REVIEW**. The three times add up to **250 minutes**. This is how long the heart is expected to be without blood flow. Up to 240 minutes is a PASS. From 241 to 360 minutes, Concord asks a clinician to look, so the result stays REVIEW.
   - **Your numbers made the pair FAIL**. The three times add up to **400 minutes**. This is how long the heart is expected to be without blood flow. More than 360 minutes is a FAIL. One value outside its limit is enough to make the whole pair FAIL.
   - **Your numbers made the pair FAIL**. You typed a distance of **800 NM**. The longest distance accepted for Maya is 750 NM. One value outside its limit is enough to make the whole pair FAIL.
9. **Open a check to see the reason** (/matches/check, practice). You can open any of the six checks to see why it passed, failed or needs a review.
   - Try: Press the last box, **Ischemic time and logistics**.
   - If Next is pressed too early: Please press the last box, Ischemic time and logistics.
10. **Read the reason** (/matches/check, practice). Each line first tells you the limit. Under it is the **evidence**, which means the exact values Concord used. Each line also shows the **source**. That is the policy, study or hospital rule the limit comes from.
11. **Saving the result** (/matches/check, practice). In your daily work you press **Save match result** when the values are correct. Concord then keeps a copy that nobody can change. After that, a clinician reads it and records a decision. Concord only gives advice. The clinician always decides.

#### Find your way around (`around`)

What each part of the screen is for.

1. **Dashboard, Patients and Donors** (/). **Patients** is the list of people waiting for a heart. **Donors** is the list of donors whose hearts are being offered. Everything else in Concord uses these two lists.
2. **Matching, Match results and Check a pair** (/). **Matching** shows the comparisons that are running now and the ones that are finished. **Match results** keeps every result. **Check a pair** is where you check one patient with one donor yourself.
3. **Criteria, Audit log and Data** (/). **Criteria** holds the limits that the checks use. **Audit log** is the list of who did what and when. **Data** is where you download records, bring in old records or load made-up practice records.
4. **When Concord is working** (/). While Concord compares records in the background, this button appears at the top of every page. Press it to see how far it has come. You can keep working while it runs.
5. **Your name** (/). Concord writes the name of the signed-in person on every record, result and decision. Please make sure it is your own name. The button next to it changes between light and dark colors.
6. **Where to find help** (/). Press **Open Guide** at any time to see all the tutorials. On a small screen it is in the menu. If you stop a tutorial before the end, Concord remembers the step you were on.

### Patients and donors

#### Add a patient (`patient`)

Fill in the patient form correctly and save it.

1. **The list of sections** (/patients/new, practice). The patient form is long, so it is divided into sections. A tick means every value in that section is filled in. A dotted circle means something is still empty. Press the name of a section to go to it.
2. **Five boxes you must fill in** (/patients/new, practice). Boxes with a star (*) are required: the medical record number, first name, last name, date of birth and sex. You cannot save the patient without them. Everything else can be added later.
3. **The state of the patient** (/patients/new, practice). When a donor is added, Concord only looks at patients whose state is **Active on waitlist**. With any other state, the patient is left out, or the result shows a reason why the patient cannot be considered now. That reason is called a blocker.
4. **Leave a box empty if you do not know** (/patients/new, practice). Please never type 0 when you mean "I do not know". Concord reads 0 as a real measurement, and the result would be wrong. An empty box means the value is not recorded yet.
   - Try: Type any height and any weight. Concord will work out the BMI (body mass index).
   - When done: Well done. Concord worked out the BMI from the two values.
   - If Next is pressed too early: Please type a height and a weight first.
5. **Unknown does not mean No** (/patients/new, practice). Choose **No** only when you are sure the answer is no. If you do not know, choose **Unknown**. Concord then shows the answer as missing, so that someone can find out.
6. **Antibodies** (/patients/new, practice). Antibodies are proteins in the patient's blood that may attack a new heart. **cPRA**, at the top of this section, is a percentage from your laboratory. It tells how many donors the antibodies would react against. Concord does not work it out, so type the value the laboratory gives you.
   - Try: We put in two antibodies for you. The number after each name is its strength (MFI). Press **Import rows**.
   - When done: Two rows were added. If Concord cannot read something, it stays in the box so that you can correct it.
   - If Next is pressed too early: Please press Import rows, next to the box.
7. **Which donors the patient accepts** (/patients/new, practice). These limits say which donors are acceptable for this one patient. If a donor is outside a limit, the result is FAIL, even if everything else passes. Please make sure the limits agree with what the patient has consented to.
8. **HLA typing** (/patients/new, practice). HLA is the patient's tissue type. Each row is one group and has two boxes. You can type a short form. If you type 2 in an A box, Concord changes it to A2. If there is only one value, leave the second box empty.
9. **Saving the patient** (/patients/new, practice). When you press **Save patient**, Concord saves the record and starts comparing this patient with every available donor. This happens in the background, so you can keep working. A message tells you that it has started.

#### Add a donor (`donor`)

Fill in the donor form correctly and save it.

1. **The donor ID and age** (/donors/new, practice). Only the donor ID is required to save. The age is written in whole years. Unlike the patient form, there is no date of birth here.
2. **How the donation happens** (/donors/new, practice). There are two types. In **DBD** the donor has died because the brain stopped working. In **DCD** the donor has died because the heart stopped beating. For DCD you also need the recovery method and the warm ischemia time, which is the time the heart had too little blood flow. Concord checks both.
3. **Risk criteria** (/donors/new, practice). These ten questions come from the United States Public Health Service (PHS). They ask about the 30 days before the organ was recovered. Tick each one that is true. They show a higher chance of a recent infection.
4. **Medicines that support the heart** (/donors/new, practice). Add one row for each medicine. The dose is in mcg/kg/min. Only vasopressin is different, and its dose is in units/hour. If you add a medicine without a dose, Concord shows the dose as missing.
5. **How well the heart pumps** (/donors/new, practice). **LVEF** is the share of blood the main pumping chamber pushes out with each beat. If the test was done again, type the second value too, because Concord uses the second one. Please fill in both wall thicknesses. If one is empty, Concord marks it as missing.
6. **Infection tests** (/donors/new, practice). Every test starts as **Not done**. Please change each one to the result from the laboratory. Concord shows a required test that is not done as missing. It never reads it as negative.
   - Try: Change the first test, **HIV antibody**, to Negative.
   - When done: Well done. The other tests still say Not done, so Concord will ask for them.
   - If Next is pressed too early: Please change the first test to Negative.
7. **Saving the donor** (/donors/new, practice). When you press **Save donor**, Concord saves the record and starts comparing this heart with every patient who is active on the waitlist. You can keep working while this runs.

#### Find a patient or donor (`find`)

Search the list and use the filters.

1. **Search the list** (/patients). You can search by the patient's name or medical record number (MRN). The list changes only after you press Enter or the search button.
   - Try: Type **Maya** and press Enter.
   - If Next is pressed too early: Please type a name and then press Enter.
2. **Show only some patients** (/patients). These boxes are filters. You can show only one state, one blood type or one level of urgency. The last box changes the order of the list. You can use filters and the search at the same time.
3. **Count boxes** (/patients). Each box counts the patients in your current list. Some boxes also work as filters when you press them.
   - Try: Press **High urgency**.
   - If Next is pressed too early: Please press the High urgency box.
4. **Show the full list again** (/patients). The Reset button removes your search and all the filters.
   - Try: Press **Reset**.
   - If Next is pressed too early: Please press Reset.
5. **Open a patient** (/patients). Press a name to open the record of that patient. The Donors page works in the same way. There you search by donor ID or by hospital.

#### Read a patient or donor record (`record`)

Warnings, missing values and the three tabs.

1. **The most important facts** (/practice/patient, practice). Under the name you see the state on the waiting list, how urgent the patient is, the blood type, the age and the sex.
2. **Risk flags** (/practice/patient, practice). A risk flag is a fact that a clinician should look at. For example, this patient has a machine that supports the heart. A flag is only a reminder. It does not decide anything.
3. **Data completeness** (/practice/patient, practice). This shows how much of the record is filled in. The empty values that matching needs are listed first. Press one to go to that place in the form.
4. **Three tabs** (/practice/patient, practice). A record has three tabs. **Overview** is a short summary. **Clinical record** shows every value. **Matches** shows the results for this person.
   - Try: Press **Clinical record**.
   - If Next is pressed too early: Please press Clinical record.
5. **Not recorded and No are different** (/practice/patient, practice). **Not recorded** means nobody has filled in that value yet. **No** means someone answered the question and the answer was no.
6. **The results for this person** (/practice/patient, practice). The Matches tab lists every result for this patient, with the newest first. On the record of a donor, this tab lists the patients that were compared with that donor.

#### Change or delete a record (`keep`)

Edit a record, match it again or delete it.

1. **Edit the record** (/practice/patient, practice). Press this button when a value changes. If you try to leave without saving, Concord asks you first. If another person saved the same record while you were editing, Concord tells you to load the page again.
2. **Editing does not start a new comparison** (/practice/patient, practice). After you edit a record, the older results stay as they were. Concord marks them **Out of date**, so you know that they used the old values.
3. **Open the menu** (/practice/patient, practice). To compare this patient again, first open the menu with the three dots.
   - Try: Press the three dots.
   - If Next is pressed too early: Please press the button with three dots.
4. **Rerun matching** (/practice/patient, practice). Rerun means run again. Concord compares this patient with every available donor again and uses the new values. Please do this after every important change.
5. **Delete the record** (/practice/patient, practice). This removes the patient from the lists and from future comparisons. Results that were already saved stay, because each result keeps its own copy of the record. Concord asks you to confirm before it deletes.

### Matching

#### Follow a match run (`run`)

See what Concord is comparing and what it found.

1. **Match runs that are working now** (/matching). A match run is one round of comparisons. It starts by itself when you save a new patient or a new donor. While it works, you see it here with a bar that shows how many pairs are finished. You can leave this page and the run continues.
2. **Stop a run** (/matching, skipped when there is none). Press **Cancel** if a run should not continue, for example when you saved a record by mistake.
3. **Find an older run** (/matching). You can show only the runs with one status, only runs for patients or for donors, or only runs between two dates.
4. **A finished run** (/matching, skipped when there is none). Each row is one run. You can see who it was for, why it started, how long it took and who started it. Press the name to open the run.
5. **The three numbers** (/matching, skipped when there is none). The numbers are PASS, REVIEW and FAIL, always in that order. So **0 · 18 · 2** means no pair was PASS, 18 pairs were REVIEW and 2 pairs were FAIL.
6. **A run that failed** (/matching, skipped when there is none). Failed here means that the run could not finish. It does not mean that the pairs failed. Open the record, press the three dots and choose **Rerun matching**. If it fails again, please tell your administrator.
7. **Inside one run** (/practice/run, practice). When you open a run, you see every pair it compared. Use these tabs to see only the PASS, REVIEW or FAIL results.

#### Understand screening results (`screen`)

The order of the list and why nothing is PASS.

1. **What screening means** (/practice/donor, practice). Screening is the first comparison, which Concord does by itself. The order of this list helps you to read it. It does not decide who receives the heart. The official order comes from OPTN, the United States organ allocation system.
2. **How the list is sorted** (/practice/donor, practice). The best result comes first. When results are equal, Concord looks at how urgent the patient is. After that it looks at child priority, at blood type priority, and at how long the patient has had the current status.
3. **Why you see REVIEW and not PASS** (/practice/donor, practice). During screening nobody knows the travel times yet. The last of the six checks cannot be finished, so a screening result is never PASS. This is normal. Look at the other five checks to learn about the pair.
4. **Blockers** (/practice/donor, practice). A blocker is a reason why this pair cannot be considered at all. For example, the patient is not active on the waiting list, or the donor is not available any more.
5. **Missing** (/practice/donor, practice). This is the number of values that the checks need but that nobody has filled in yet. When you fill them in and check the pair again, the result becomes clearer.
6. **Check one of these pairs** (/practice/donor, practice). Press **Check this pair** to enter the travel times and the other missing values. The patient and the donor are already chosen for you.

### Results and decisions

#### Read a match result (`result`)

What the result says, why, and what is missing.

1. **The result is at the top** (/practice/result, practice). First you see PASS, REVIEW or FAIL for the whole pair. Below it there is one small box for each of the six checks. The most serious check decides the overall result.
2. **Go to one check** (/practice/result, practice). Press a box to go to the details of that check. A question mark in a box means that a value is missing.
   - Try: Press the **Size** box.
   - If Next is pressed too early: Please press the Size box.
3. **The reason for the result** (/practice/result, practice). This check compares the size of the two hearts. **PHM ratio** is the estimated weight of the donor's heart divided by the estimated weight of the patient's heart. **Evidence** shows the numbers that were used.
4. **What still needs to be filled in** (/practice/result, practice). Each row is one missing value and the check that needs it. The link on the right takes you to the place where you can fill it in.
5. **The other tabs** (/practice/result, practice). You can also see both people next to each other, or see the travel times that were used.
   - Try: Press **Patient vs donor**.
   - If Next is pressed too early: Please press Patient vs donor.
6. **Patient and donor together** (/practice/result, practice). The same values of both people are in two columns. This is useful when you discuss a pair with your team.
7. **A saved result does not change** (/practice/result, practice). Concord keeps the records, the pair inputs and the limits exactly as they were when the result was saved. You can also see when it was saved and by whom.
8. **No decision here yet** (/practice/result, practice). This is a screening result, so a clinician cannot record a decision on it. First press **Complete this match**, fill in the missing values and save. Then the decision form appears.

#### Check a pair (`check`)

What every box on this page means.

1. **Choose the patient and the donor** (/matches/check, practice). Type a name, a medical record number or a donor ID, press Enter and choose from the list. If you came here from a screening list, both are already chosen.
2. **Distance and times** (/matches/check, practice). Distance is how far the donor hospital is. Procurement and packaging, transport, and implant are three separate times in minutes. Leave a box empty if you do not know the value. If the patient has had heart surgery or has a heart device, do not add extra time. Concord adds it for you.
3. **How the heart is kept** (/matches/check, practice). Choose how the heart is kept during transport, for example on ice. Normothermic perfusion means a machine keeps the heart warm and supplied with blood. Type those minutes only if that machine is used. Concord then takes them off the time without blood flow.
4. **Crossmatch tests** (/matches/check, practice). A crossmatch is a laboratory test. It shows whether the patient's antibodies react with the donor's cells. Please choose the result you have. If a test was positive, never leave it as **Not done**, because Concord cannot warn you about a result it does not know.
5. **The result changes while you type** (/matches/check, practice). Concord works out the result again after every change. Nothing is saved at this point. Read each check that is REVIEW or FAIL before you continue.
6. **Save the result** (/matches/check, practice). When you press **Save match result**, Concord works it out one more time from the saved records and keeps a copy. Then it opens the saved result, where a clinician can record the decision.

#### Record a decision (`decide`)

Accept, decline or defer, step by step.

1. **The decision form** (/practice/result, practice). This form appears only on a result that a person checked and saved. A screening result does not have it. The form starts on **Defer**, which means more information is needed before a decision.
2. **Choose the decision** (/practice/result, practice). The choices are accept the offer, decline the offer, or defer. Concord only gives advice. A clinician may accept a pair even when the result is FAIL, and explains why in the rationale.
   - Try: Choose **Decline offer**.
   - When done: Well done. Reasons for declining now appear further down.
   - If Next is pressed too early: Please change Decision to Decline offer.
3. **The reason for declining** (/practice/result, practice). When you decline, you must tick at least one reason. Tick every reason that is true.
   - Try: Tick one reason.
   - When done: Well done. You can tick more than one.
   - If Next is pressed too early: Please tick at least one reason.
4. **Who made the decision** (/practice/result, practice). This box starts with your own name. If another clinician made the decision and you are only recording it, type the name of that clinician.
5. **The rationale** (/practice/result, practice). Rationale means the explanation of the decision. It is required. Please write it in full sentences, so that another clinician can understand it even a year from now.
6. **Confirm that you read everything** (/practice/result, practice). If any check is FAIL or REVIEW, you must tick this box before you can save. Please tick it only after you have really read all of them.
7. **A saved decision is final** (/practice/result, practice). Nobody can change or delete a decision after it is saved. If a decision was wrong, check the pair again. This makes a new result. Record the correct decision there and explain the correction in the rationale.

#### Find an older result (`past`)

Search all saved results with the filters.

1. **All saved results** (/matches). This page lists every result. With these filters you can show only one kind of result, only one kind of decision, or only results saved between two dates.
2. **Where a result came from** (/matches). **Screening** means Concord made the result by itself during a match run. **Checked pair** means a person filled in the missing values and saved it.
3. **Results that wait for a decision** (/matches). Set this filter to **Pending** to see the checked pairs for which no decision has been recorded yet.
4. **Out of date** (/matches, skipped when there is none). This label means that the patient, the donor or the limits changed after the result was saved. The result itself stays as it was.
5. **Open a result** (/matches, skipped when there is none). Press PASS, REVIEW or FAIL to open the result. Press the name of the patient or the ID of the donor to open that record.

#### When a result is out of date (`ood`)

What it means and how to get a new result.

1. **Out of date** (/practice/result, practice). The patient's record, the donor's record or the limits changed after this result was saved. The result may be different today.
2. **The old result is kept** (/practice/result, practice). Concord does not change or delete the old result. It shows what was known on that day. This is important if a decision was made with it.
3. **Check the pair again** (/practice/result, practice). Press this link to open Check a pair. The same patient and donor are already chosen. Fill in the values and save, and you will have a new result.
4. **Make all screening results new** (/practice/patient, practice). If you changed a record and want new screening results for every pair, open the record. Press the three dots and choose **Rerun matching**.

### Limits, history and data

#### Change the criteria (`criteria`)

The limits that the checks use.

1. **What criteria are** (/criteria). Criteria are the limits that Concord uses in its checks. For example, how many minutes without blood flow are still a PASS. Only the person chosen by your program should change them, because they affect every new result.
2. **One tab for each check** (/criteria). The limits are in six tabs, one for each of the six checks.
   - Try: Press **HLA and antibodies**.
   - If Next is pressed too early: Please press HLA and antibodies.
3. **Where a limit comes from** (/criteria). Under each limit you see its source. It can be a policy, a study or a choice of your hospital. If two limits do not fit together, Concord tells you and does not accept them.
4. **Explain the change** (/criteria). You must write a change note. Please write what you changed and why. The note is kept together with the new limits.
5. **Look at the changes again** (/criteria). When you press **Review and publish**, Concord first shows the old values and the new values next to each other. Nothing changes until you confirm. You can still cancel.
6. **Earlier versions are kept** (/criteria). Each time you publish, Concord makes a new version. New checks use the new version. Results that were saved earlier keep their old version and are marked **Out of date**.

#### Read the audit log (`audit`)

See who did what and when.

1. **What the audit log is** (/audit). It is the list of everything people did in Concord, such as adding a record or recording a decision. The newest entry is at the top. Nobody can change or delete a single entry.
2. **Show one kind of entry** (/audit). Choose one action here, for example **Decision recorded**, to see only those entries.
3. **How to read an entry** (/audit, skipped when there is none). Each row shows the time, the person, the action and a short summary. The time is shown in the time of your own place.

#### Work with data (`data`)

Download, bring in, practice records and reset.

1. **Export: download a copy** (/data). This downloads the patients, the donors, the history of the criteria and a list of the results in one file. Please keep the file in a safe place. It does not contain everything, so it is not a full backup of the database.
2. **Import: bring in old records** (/data). This is for a backup file from the earlier version of Concord. Concord first shows you what is in the file and asks before it adds anything. Records that already exist are not changed.
3. **Load practice records** (/data). This adds made-up patients and donors, and Concord starts to compare them. If you press it twice, no record is added twice.
4. **Reset: please be very careful** (/data). Reset deletes all patients, donors, results and decisions for **everyone** who uses this database. It cannot be undone in Concord. You must type RESET before the button works. Please ask your administrator to make a backup first.
