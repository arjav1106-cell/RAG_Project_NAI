# Vehicle Insurance Management and Policy Assistant

An India-focused **Legal domain** project exploring how Retrieval-Augmented Generation (RAG) can make vehicle insurance information easier to manage and understand. The planned application brings a user's vehicles, policy details, and insurance documents together, then answers questions using the user's own policy documents and a curated legal and regulatory knowledge base.

> **Project status:** Ideation and initial scope. Implementation details and the final project structure will be documented here as development begins.

## Problem

People who own multiple cars, bikes, or scooters may have policies from different insurers, with different coverage, add-ons, policy periods, premiums, and renewal dates. Important details are spread across policy PDFs, emails, insurer portals, and vehicle apps. Finding the right clause can be difficult, especially when someone needs to understand their coverage after an accident or before modifying a vehicle.

Existing vehicle and insurance apps help with parts of this problem, but a policyholder may still need to locate and interpret the exact terms in their own policy. This project focuses on organizing those policies and making their terms easier to search and understand.

## Proposed solution

The application will provide a digital garage for a user's vehicles and their insurance information. Users can upload policy documents, review extracted details, track renewals and past claims, and ask questions in natural language. A RAG pipeline will retrieve relevant passages from the user's documents and trusted legal or regulatory sources, then generate a plain-language explanation with references to those sources.

The assistant is intended to explain information in the available sources. It cannot guarantee that an insurer will accept a claim or replace advice from an insurer or qualified professional. Claim outcomes depend on the full policy and the specific facts of a case.

## Existing apps and the opportunity

Several Indian apps already provide related features. The comparison below describes capabilities publicly presented by these services; it is not a claim that their products lack other features.

| Service | Related capabilities | Opportunity for this project |
| --- | --- | --- |
| [CRED Garage](https://cred.club/garage) | Vehicle garage and personalized motor insurance experiences. CRED's [privacy policy](https://cred.club/legal/privacy) also describes consolidating motor insurance details and renewal reminders when a user enables connected services. | Focus on explanations grounded in the exact policy documents a user uploads, with clause-level references across multiple vehicles and insurers. |
| [Policybazaar app](https://www.policybazaar.com/insurance-app/) | Policy management, vehicle information and alerts, comparisons, and insurance services. | Emphasize policy-specific Q&A and coverage summaries across a user's existing policies, regardless of where they bought them. |
| [mParivahan](https://mparivahan.parivahan.gov.in/) | Government vehicle services, including access to vehicle insurance validity information. The Government of India's [advisory](https://parivahan.gov.in/parivahan/sites/default/files/NOTIFICATION%26ADVISORY/17th%20Dec%202018.pdf) also describes digital vehicle documents through mParivahan and DigiLocker. | Complement validity checks with a private, user-managed library of policy wording, add-ons, claims history, and renewal information. |
| [PhonePe Insurance AI assistant](https://www.phonepe.com/insurance/terms/) | AI-assisted motor-insurance information and a purchase journey. Its terms describe AI explanations as preliminary and state that the issued policy document governs. | Center the experience on explaining policies the user already holds, retrieving supporting clauses, and clearly identifying unanswered questions. |

The proposed distinction is the combination of a **multi-vehicle policy organizer** and a **citation-backed, policy-specific RAG assistant**. The project will demonstrate that distinction in a limited prototype; it is not intended to replace the services above.

## Project scope

The initial project is a functional RAG prototype for Indian motor insurance. It will support cars, bikes, and scooters, and allow users to manage policies from different insurers in one place.

The knowledge base is planned to include policy documents supplied by the user and a curated set of relevant official legal and regulatory sources, such as the [Motor Vehicles Act, 1988](https://www.indiacode.nic.in/bitstream/123456789/1798/1/198859.pdf) and applicable [IRDAI material](https://irdai.gov.in/). Answers should identify the sources they rely on and distinguish facts found in a document from details the user still needs to provide.

The prototype will explain coverage based on retrieved terms, but it will not decide or guarantee real claim outcomes, issue legal advice, buy or renew policies, or submit claims to insurers. An insurer's issued policy and claim assessment remain authoritative.

## Planned features

### Garage and policy management

- Add, view, update, and remove vehicles, including cars, bikes, and scooters.
- Associate one or more insurance policies with each vehicle, including policies from different insurers.
- Upload and retain policy documents for future reference.
- Extract policy details such as insurer, policy number, vehicle, cover type, policy period, premium, and selected add-ons; let users review and correct extracted information.
- Track expiry dates, payment amounts and schedules where applicable, insurer details, coverage, add-ons, and past claims.
- Show upcoming renewals and potential gaps when relevant coverage periods differ.

### RAG policy assistant

- Answer natural-language questions using the user's uploaded policies and the curated knowledge base.
- Cite the relevant policy clauses or legal and regulatory sources alongside answers.
- Summarize coverage, exclusions, add-ons, conditions, and claim procedures in plain language.
- Explain, based on the uploaded policy, whether a described type of damage appears to fall under own-damage or third-party cover, and identify missing facts or relevant exclusions.
- Explain relevant policy conditions for planned vehicle modifications and suggest confirming changes with the insurer when the documents do not settle the question.
- Say when the available documents do not provide enough information, instead of presenting an unsupported answer as certain.

### Claims and policyholder support

- Provide an accident reporting and claim-preparation checklist based on the user's policy and relevant sources.
- Help organize claim history and important claim-related documents for each vehicle.
- Explain insurer grievance steps and point users to official resources such as [IRDAI's Bima Bharosa portal](https://bimabharosa.irdai.gov.in/Home/FAQ).

### Usability features to explore

- Compare the coverage and add-ons recorded for a user's vehicles.
- Provide accessible, plain-language summaries, with multilingual explanations as a possible extension.
- Offer renewal reminders and clear indicators for upcoming expiries or potential coverage gaps.

## Expected impact

The project aims to help vehicle owners keep insurance information organized, find important terms more quickly, understand differences between policies, and prepare for renewals or claim conversations. Source-backed answers can make insurance language more approachable while showing users where each explanation came from.

The project will also demonstrate a practical RAG workflow: document ingestion, retrieval from user-specific and curated sources, context-aware generation, and source references. Its answers are informational and should not be treated as a promise of coverage or a claim decision.

## Development notes

As implementation begins, this README will be expanded with the actual application workflow, architecture, setup instructions, and repository structure. Those details will be documented to match the code as it is built.
