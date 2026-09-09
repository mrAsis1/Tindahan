# Hosted notebook acceptance checks

Use the private [development app](https://tindahan-development.monarchrenante27.chatgpt.site) and fictional records only. The deployed app uses Supabase; these records are separate from the local browser demo.

## Repeatable ledger check

Create a uniquely named customer such as **Hosted UI check 9 September 2026**, with the identifying note **Fictional hosted acceptance check; no real debt or payment**. Leave the phone number blank. If resuming an interrupted check, search for the customer and inspect its history before saving anything again.

| Step                                        | Expected result                                              |
| ------------------------------------------- | ------------------------------------------------------------ |
| Create the customer                         | Starting balance ₱0.00                                       |
| Search by the unique name                   | The new customer appears with the identifying note           |
| Add ₱150 utang with a fictional description | Balance ₱150.00; one utang entry                             |
| Record a ₱50 payment                        | Balance ₱100.00                                              |
| Reload customer history                     | Balance stays ₱100.00; both entries remain                   |
| Record the remaining ₱100 payment           | Balance ₱0.00; fully paid                                    |
| Reload the nested customer URL              | One ₱150 utang and two payments totaling ₱150; no duplicates |
| Open the same customer on the phone         | The same three entries and zero balance                      |

Keep the zero-balance fixture for traceability. Do not delete existing records or reset the notebook. Whole-store totals can include other fixtures, so validate this customer's history separately.

## Phone and recovery check

On the physical phone, check scrolling, tap targets, and whether the keyboard covers fields or save buttons. A desktop browser set to phone dimensions does not verify these behaviors.

For recovery, finish the private Site access sign-in, then request one reset email from the hosted app's **Forgot password?** page. Open the newest email on the phone, enter and confirm a new password privately, and sign in again. Verify the same notebook remains. If the private access gate interrupts the callback, finish that sign-in and reopen the newest link. Never share passwords or reset-link tokens. See [account recovery](account-recovery.md).

## Results — 9 September 2026

- The owner confirmed that the hosted notebook loads on their phone.
- Direct navigation to hosted `/auth/forgot-password` and a full reload both rendered the email-request form. Direct navigation to `/auth/reset-password` without credentials rendered **Reset link unavailable** with the request-new-link action. No email was sent and no password was changed in these checks.
- The missing-link page was checked with a 390×844 viewport; the document width was 390px, with no horizontal overflow. This is desktop browser emulation, not a physical-phone keyboard check.
- After owner sign-in, the complete hosted ledger sequence passed at 390×844: customer creation at zero, unique-name search, ₱150 utang, ₱50 partial payment, reload at ₱100 remaining, ₱100 final payment, and reload at zero. History contains exactly one utang and two payments. The history page has no horizontal overflow at this viewport. These were actual hosted UI writes through the app to development Supabase, without HTTP interception or direct SQL writes.
- Fixture customer: `98c0d654-226f-420e-9cfc-562eea2f9488` (**Hosted UI check 9 September 2026**). Utang: `ce7b71a2-fc96-49a8-ae85-2f0314a2e123`; partial payment: `4b2a6317-55f8-46cc-887c-cbf322cba3a8`; final payment: `cb88c9e9-abdf-45d5-a223-93d2a3c00957`. All existing records were preserved.
- Dashboard and Daily Record both show ₱650 utang and ₱650 payments for 9 September, up from ₱500 each before this check. Outstanding remains zero. Daily Record shows all three new entries among 15 entries that day.
- The owner confirmed both requested physical-phone checks passed: the fixture showed the same ₱150 utang, ₱50/₱100 payments, and zero balance; the hosted recovery email, new-password update, and subsequent sign-in also worked. Passwords and reset links were handled privately by the owner.
- Creating transactions directly on the physical phone and keyboard behavior remain unverified. The successful phone comparison verifies reading the hosted entries across devices.

The existing automated local/fictional-API browser tests and development database concurrency checks provide separate coverage; they are not substitutes for these hosted UI and physical-device checks.
