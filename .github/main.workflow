workflow "Default" {
  resolves = ["NPM Install"]
  on = "push"
}

action "NPM Install" {
  uses = "docker://node:8"
  args = "npm install"
}
