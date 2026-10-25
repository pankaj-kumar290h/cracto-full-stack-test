The goal of this assignment is to build a functional modern web application.

This application is a release checklist tool that could help developers with their release process. Here are the mockups: https://public-swap.s3.us-east-1.amazonaws.com/releasecheck.png

The application has only one main model: Release. A Release is composed of multiple Steps and has the following properties:

A name (text, mandatory)
A date (datetime, mandatory)
A status (planned|ongoing|done, auto)
Additional info (text, optional)
A release keeps track of the completion state of the different steps. A Step has only two states: on or off.

The status is not chosen by the end user, it is simply computed from the steps state:

No step completed: planned
At least one step completed: ongoing
All steps completed: done
For the sake of this example, let's assume that a release is done in 7 to 10 steps. The mock-ups include few example steps but feel free to change them.

To keep things simple, the steps are the same for every release and don't change over time - you don't need to have a database table to store each step, as long as you store, for each release, which step has been completed.

Must-have
Users should be able to view a list of all the releases
Users should be able to create a new release (with a name, due date, and optional "additional information")
Users should be able to check / uncheck the steps that are part of a release
Users should be able to update the release additional information
The whole codebase should be contained in a single repository available on GitHub
The end result should be a single-page application
The application state should be stored in a PostgreSQL or MySQL database (hosted online)
The frontend and the backend should communicate using an API
The app is styled with a few CSS rules, and should have a simple, usable UX (no time for fancy design stuff)
There should be a small README.md file with the instructions needed to run the code locally
Users should be able to delete a release
Users should benefit from a responsive interface
The frontend and backend should use GraphQL as the API layer
The backend should be easily run locally with Docker (Dockerfile + docker-compose.yaml)
The codebase should contain a couple of automated tests
Please note that this shouldn't be a multi-user application. It does not need any kind of user management.

In your README file, list down your API endpoints as well as your database schema.