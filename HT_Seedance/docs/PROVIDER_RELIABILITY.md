# Provider Reliability

Provider automation is fail-safe. Unknown pages, insufficient confidence, missing or ambiguous controls, unverifiable configuration, unknown dialogs, lost ownership, and uncertain submission state stop the workflow without clicking. It is for authorized sessions only and has no CAPTCHA bypass, stealth, fingerprint spoofing, proxy rotation, account creation, or quota circumvention.

## Selector and recognition strategy

Dola definitions are centralized under `providers/dola/selectors`. Candidate priority is test ID, semantic role, accessible name/label, scoped stable text, stable CSS, then XPath only if unavoidable. `ControlResolver` checks visibility, enabled state, and uniqueness and returns `FOUND`, `NOT_FOUND`, `AMBIGUOUS`, `DISABLED`, or `HIDDEN`. Ambiguity is never converted into `.first()`.

Page recognition combines URL/title metadata with landmarks and controls to identify HOME, LOGIN_REQUIRED, VIDEO_GENERATION, GENERATION_RUNNING, RESULT_READY, ERROR_PAGE, or UNKNOWN. Submit requires VIDEO_GENERATION at HIGH confidence.

## Submit, monitor, and result safety

`SafeSubmitGuard` verifies session, page confidence, model/prompt/options read-back, required media, one visible enabled Generate control, job ownership, active attempt, and no prior submission identity. Identity is stored before clicking. Uncertain state returns `SUBMISSION_STATE_UNKNOWN` and is not clicked again automatically.

Monitoring requires positive progress, completion, failure, session, or provider-error evidence. Spinner absence is not completion. Download requires a unique result/action plus submission timing/context and rejects stale generation identity.

## Circuit breaker and incidents

Five consecutive structural failures open the circuit. CLOSED, OPEN, and HALF_OPEN state persists in `provider-reliability.json`; restart cannot release queued jobs into an unsafe provider. Resume is manual. Login failure is account-scoped and does not increment the global structural counter. Similar failures are clustered by code/control with affected jobs/accounts.

## Diagnostics and maintenance

Meaningful failures capture bounded screenshots, recognition/confidence, URL/title, expected control, selector evidence, and sanitized structural DOM. Input/textarea values, password nodes, and auth/token/cookie/secret-like attributes are removed. Defaults retain at most 500 artifacts and seven days; outputs and browser profiles are never deleted.

To update an integration: reproduce with a sanitized fixture, inspect resolver evidence, add the strongest legitimate candidate centrally, add regression cases, run all checks, then manually resume only after uniqueness and confidence pass. Live testing is minimal and skipped when no authorized session exists.
