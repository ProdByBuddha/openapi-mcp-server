# n8n MCP Tools

Total tools: 40

## Audit
- n8n.v1.Audit.post__audit — Generate an audit

## Credential
- n8n.v1.Credential.deleteCredential — Delete credential by ID
- n8n.v1.Credential.get__credentials_schema__credentialTypeName_ — Show credential data schema
- n8n.v1.Credential.post__credentials — Create a credential

## Execution
- n8n.v1.Execution.delete__executions__id_ — Delete an execution
- n8n.v1.Execution.get__executions — Retrieve all executions
- n8n.v1.Execution.get__executions__id_ — Retrieve an execution

## Projects
- n8n.v1.Projects.delete__projects__projectId_ — Delete a project
- n8n.v1.Projects.delete__projects__projectId__users__userId_ — Delete a user from a project
- n8n.v1.Projects.get__projects — Retrieve projects
- n8n.v1.Projects.patch__projects__projectId__users__userId_ — Change a user's role in a project
- n8n.v1.Projects.post__projects — Create a project
- n8n.v1.Projects.post__projects__projectId__users — Add one or more users to a project
- n8n.v1.Projects.put__projects__projectId_ — Update a project

## SourceControl
- n8n.v1.SourceControl.post__source-control_pull — Pull changes from the remote repository

## Tags
- n8n.v1.Tags.delete__tags__id_ — Delete a tag
- n8n.v1.Tags.get__tags — Retrieve all tags
- n8n.v1.Tags.get__tags__id_ — Retrieves a tag
- n8n.v1.Tags.post__tags — Create a tag
- n8n.v1.Tags.put__tags__id_ — Update a tag

## User
- n8n.v1.User.delete__users__id_ — Delete a user
- n8n.v1.User.get__users — Retrieve all users
- n8n.v1.User.get__users__id_ — Get user by ID/Email
- n8n.v1.User.patch__users__id__role — Change a user's global role
- n8n.v1.User.post__users — Create multiple users

## Variables
- n8n.v1.Variables.delete__variables__id_ — Delete a variable
- n8n.v1.Variables.get__variables — Retrieve variables
- n8n.v1.Variables.post__variables — Create a variable
- n8n.v1.Variables.put__variables__id_ — Update a variable

## Workflow
- n8n.v1.Workflow.delete__workflows__id_ — Delete a workflow
- n8n.v1.Workflow.get__workflows — Retrieve all workflows
- n8n.v1.Workflow.get__workflows__id_ — Retrieves a workflow
- n8n.v1.Workflow.get__workflows__id__tags — Get workflow tags
- n8n.v1.Workflow.post__workflows — Create a workflow
- n8n.v1.Workflow.post__workflows__id__activate — Activate a workflow
- n8n.v1.Workflow.post__workflows__id__deactivate — Deactivate a workflow
- n8n.v1.Workflow.put__credentials__id__transfer — Transfer a credential to another project.
- n8n.v1.Workflow.put__workflows__id_ — Update a workflow
- n8n.v1.Workflow.put__workflows__id__tags — Update tags of a workflow
- n8n.v1.Workflow.put__workflows__id__transfer — Transfer a workflow to another project.
