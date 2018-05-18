# Debugging in vscode

Example debug configuration

```
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "UnitTests",
            "program": "${workspaceRoot}/build-test/test/runners/unit.js",
            "protocol": "auto",
            "preLaunchTask": "npm: tsc:test"
        },
        {
            "type": "node",
            "request": "launch",
            "name": "IntegrationTests",
            "program": "${workspaceRoot}/build-test/test/runners/integration.js",
            "protocol": "auto",
            "preLaunchTask": "npm: tsc:test"
        }
    ]
}

```