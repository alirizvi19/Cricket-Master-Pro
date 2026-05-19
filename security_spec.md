# Security Specification - CricMaster Pro

## Data Invariants
1. **User Ownership**: A user can only modify their own profile document (`/users/{userId}`).
2. **Tournament Authority**: Only the `organizerId` of a tournament can manage its teams, matches, and players.
3. **Identity Integrity**: For sensitive operations (invitations, join requests), the UID or Email must match the authenticated user.
4. **Relationship Integrity**: Documents in subcollections (like `balls`) must belong to a parent document (like `matches`) that is accessible to the user.
5. **Role Safety**: Users cannot elevate their own roles from `user` to `admin`.

## The "Dirty Dozen" Payloads
These payloads should be rejected by the security rules:
1. **Identity Spoofing (User)**: Create a user document with a different UID than `request.auth.uid`.
2. **Privilege Escalation**: Update own user profile to set `role: 'admin'`.
3. **Tournament Hijacking**: Create a tournament where `organizerId` is not the sender's UID.
4. **Unauthorized Match Update**: A non-organizer attempting to record a ball in a match.
5. **Orphaned Ball**: Create a ball for a match that doesn't exist.
6. **Shadow Player**: Add a player to a team you don't manage.
7. **Malicious Match Status**: Set match status to `completed` without being the organizer.
8. **Invitation Forgery**: Create an invitation for a tournament you don't organize.
9. **Join Request Spoofing**: Create a join request for another user's UID.
10. **Data Corruption (Strings)**: Inject a 1MB string into the `name` field of a tournament.
11. **Negative Scoring**: Update a match score with negative runs.
12. **Recursive List Attack**: Query all users without any filtering by UID or role.

## Field Validation Helpers
Every entity will have an `isValid[Entity]` function enforcing types and sizes.

## Terminal State Locks
- If a match is `completed`, certain fields like `currentScore` or `winnerId` should be locked (unless admin).
