Document: Product Enhancements (MVP+)
1. Dashboard & Statistics (Analytics View)
User Story: As a user, I want to have a dashboard with statistics (task history, project history, task execution duration — time between creation and closure) so that I can analyze my productivity during my weekly review.

Acceptance Criteria:

A dedicated "Analytics" or "Dashboard" screen.

Display of the number of closed tasks and projects for a selected period (week/month).

An "Average Cycle Time" metric (average time from Inbox status to Done status).

A list (history) of recently completed projects and tasks.

2. Inbox Processing: "Go Back" Action
User Story: As a user, I want the ability to go back one step (a "Back" or "Undo" button) while processing a task in the Inbox to correct a mistake if I accidentally select the wrong answer in the flow.

Acceptance Criteria:

A "Back" button is present at every step (except the first one) in the "Inbox Processing" modal.

Clicking the button returns the user to the previous question while preserving the context of the current task.

3. Delegation: Deadlines for "Waiting For"
User Story: As a user, when I delegate a task (move it to the "Waiting For" list), I want to specify the time/date it must be completed by, so that the system can track this deadline.

Acceptance Criteria:

A mandatory (or optional) due_date field is added when routing a task to the "Waiting For" list.

The deadline is clearly visible next to each delegated task in the "Waiting For" list view.

4. Delegation: Automated Calendar Reminders
User Story: As a user, when I set a deadline for a delegated task, I want an automated reminder event created in my calendar (or the assignee's calendar, if integrated) 1 day before the deadline to prevent overdue tasks.

Acceptance Criteria:

If a task has the "Waiting For" status and a due_date is set, the system uses the Google Calendar API to create a reminder event (All-day event or specific time) 24 hours before the deadline.

The event title is formatted as: [Reminder] Check status: {Task Title} assigned to {Assignee}.

5. "Today" Focus View
User Story: As a user, I want to see a single list of tasks for today (tasks where the deadline is set to today's date, including the first steps of active projects) so that I can clearly see my hard focus for the day.

Acceptance Criteria:

A dedicated "Focus" or "Today" screen.

The screen aggregates: Google Calendar events for the current date + tasks from the "Next Actions" and "Projects" lists where due_date == today.

6. As a user, I want to have confirmation pop-up for tasks processing (delete, move, restore etc)
