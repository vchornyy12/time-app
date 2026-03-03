1. Product Vision
Create a minimalist yet powerful web application for task management based on the GTD methodology. The app serves as a "single window" to offload the brain and capture incomplete cycles. The visual style is Apple Liquid Glass (glassmorphism, smooth animations, zero visual noise) to promote deep focus. The core feature of the MVP is strict adherence to the "Inbox" processing algorithm  and convenient management of multi-step projects via Drag & Drop.
+4

2. Core Requirements (MVP Functional Requirements)
Authentication: Simple login (Email/Password or Google) via Supabase Auth.


Inbox: A dedicated space for the rapid capture of all open loops (thoughts, ideas, tasks).


Algorithmic Processing: The interface must guide the user through a strict sequence of questions for each task taken from the Inbox.
+2

Project Management (Drag & Drop): A Kanban-style board or list where tasks can be reordered and moved.


"Next Step" Logic: According to the documentation, a project is a multi-step task. Each project must have defined completion criteria , a rough plan , and a mandatory first step. When the first step (which is a single-step task ) is completed, the user must be able to easily convert the next item from the plan into a new active task.
+4

3. User Flows
Based on the provided Inbox processing flowchart, here is the core flow within the app:

Flow 1: Capture
User opens the app.

A prominent input field (Liquid Glass input) is always accessible at the top of the screen.

The user types any thought (e.g., "Need to attend a training" ) and presses Enter.

The task instantly drops into the "Inbox" list.

Flow 2: Clarify & Organize (Inbox Processing)
This flow is based strictly on the provided flowchart. The user opens the Inbox, selects a single task, and the system guides them (via UI buttons):
+1

"Actionable?" ("Is there something to be done with this?" )


No : Move to "Trash" or "Notes".
+2


Yes: Move to the next step.

"For me?" ("Do I have to do it?" )
+1


No : Move to the "Waiting For" list (Delegated).
+2


Yes: Move to the next step.

"Now?" ("Today, within a few days or a week" )


No : Move to "Calendar" (if there is an exact date ) or "Someday/Maybe".
+4


Yes: Move to the next step.


"Single-step task?" 


No : A new Project is created. The system requires the user to fill in: Completion Criteria , Rough Plan , and First Step.
+4


Yes: Move to the next step.


"Can it be done in 5 minutes?" (Note: The text mentions the 2-minute rule , but we will stick to 5 minutes for the UI as per the flowchart ).
+1


Yes : "DO IT NOW!"  — the task is marked as completed.
+1


No : Move to the "Next Actions" (Current Actions) list.
+2

Flow 3: Project Management & Next Steps
The user navigates to the "Projects" section.

Opens a project. Sees the "Rough Plan" field (a list of future steps ) and the highlighted "First Step" (which operates as a full-fledged task in the system ).
+1

The user marks the "First Step" as completed.

The UI prompts a Drag & Drop action: the user grabs the next item from the "Rough Plan" and drags it into the "Active Task" zone (converting the draft into a real task with the "Next Actions" status). This directly aligns with the rule of assigning a new first step after completing the previous one.