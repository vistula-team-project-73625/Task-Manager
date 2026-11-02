
let supabaseUrl = "";
let supabaseKey = "";
let tableName = "tasks";

let editingTaskId = null;

const taskForm = document.getElementById("task-form");
const taskTitle = document.getElementById("task-title");
const taskDescription = document.getElementById("task-description");
const taskList = document.getElementById("task-list");
const statusMessage = document.getElementById("status-message");
const taskSubmit = document.getElementById("task-submit");
const formHeading = document.getElementById("form-heading");

// Display messages
function showMessage(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? "#dc2626" : "#15803d";
}

// Supabase REST API request
async function apiRequest(endpoint, options = {}) {
    const response = await fetch(
        `${supabaseUrl}/rest/v1/${endpoint}`,
        {
            ...options,
            headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
                ...options.headers
            }
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Database operation failed.");
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

// Load all tasks
async function loadTasks() {
    try {
        showMessage("Loading tasks...");

        const tasks = await apiRequest(
            `${tableName}?select=*&order=id.desc`
        );

        displayTasks(tasks);

        showMessage(`${tasks.length} task(s) loaded.`);
    } catch (error) {
        showMessage("Error loading tasks: " + error.message, true);
    }
}

// Get one task by ID
async function getTaskById(id) {
    const tasks = await apiRequest(
        `${tableName}?id=eq.${encodeURIComponent(id)}&select=*`
    );

    return tasks[0] || null;
}

// Display tasks
function displayTasks(tasks) {
    taskList.replaceChildren();

    if (tasks.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "No tasks yet. Add your first task!";
        taskList.appendChild(emptyMessage);
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = task.completed
            ? "task-item completed"
            : "task-item";

        item.dataset.id = task.id;

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.title;

        const description = document.createElement("p");
        description.className = "task-description";
        description.textContent = task.description || "No description";

        const status = document.createElement("p");
        status.className = "task-status";
        status.textContent = task.completed
            ? "Completed"
            : "Incomplete";

        const editButton = document.createElement("button");
        editButton.className = "edit-task";
        editButton.textContent = "Edit";

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-task";
        deleteButton.textContent = "Delete";

        const toggleButton = document.createElement("button");
        toggleButton.className = "toggle-task";
        toggleButton.textContent = task.completed
            ? "Mark Incomplete"
            : "Mark Complete";

        item.append(
            title,
            description,
            status,
            editButton,
            deleteButton,
            toggleButton
        );

        taskList.appendChild(item);
    });
}

// Add or update a task
taskForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const title = taskTitle.value.trim();
    const description = taskDescription.value.trim();

    if (!title) {
        showMessage("Please enter a task title.", true);
        return;
    }

    taskSubmit.disabled = true;

    try {
        if (editingTaskId !== null) {
            await apiRequest(
                `${tableName}?id=eq.${encodeURIComponent(editingTaskId)}`,
                {
                    method: "PATCH",
                    headers: {
                        "Prefer": "return=representation"
                    },
                    body: JSON.stringify({
                        title: title,
                        description: description
                    })
                }
            );

            showMessage("Task updated successfully!");
        } else {
            await apiRequest(tableName, {
                method: "POST",
                headers: {
                    "Prefer": "return=representation"
                },
                body: JSON.stringify({
                    title: title,
                    description: description,
                    completed: false
                })
            });

            showMessage("Task added successfully!");
        }

        resetForm();
        await loadTasks();

    } catch (error) {
        showMessage("Error saving task: " + error.message, true);
    } finally {
        taskSubmit.disabled = false;
    }
});

// Reset form after saving or cancelling
function resetForm() {
    editingTaskId = null;
    taskForm.reset();
    taskSubmit.textContent = "Add Task";
    formHeading.textContent = "Add New Task";
}

// Handle task buttons
taskList.addEventListener("click", async function(event) {
    const button = event.target;

    const item = button.closest(".task-item");

    if (!item) return;

    const id = item.dataset.id;

    try {
        // Edit task
        if (button.classList.contains("edit-task")) {
            const task = await getTaskById(id);

            if (!task) {
                throw new Error("Task not found.");
            }

            editingTaskId = task.id;
            taskTitle.value = task.title;
            taskDescription.value = task.description || "";

            taskSubmit.textContent = "Save Changes";
            formHeading.textContent = "Edit Task";

            taskForm.scrollIntoView({ behavior: "smooth" });
        }

        // Delete task
        else if (button.classList.contains("delete-task")) {
            if (!confirm("Are you sure you want to delete this task?")) {
                return;
            }

            await apiRequest(
                `${tableName}?id=eq.${encodeURIComponent(id)}`,
                {
                    method: "DELETE"
                }
            );

            showMessage("Task deleted successfully!");
            await loadTasks();
        }

        // Toggle completion
        else if (button.classList.contains("toggle-task")) {
            const task = await getTaskById(id);

            if (!task) {
                throw new Error("Task not found.");
            }

            await apiRequest(
                `${tableName}?id=eq.${encodeURIComponent(id)}`,
                {
                    method: "PATCH",
                    headers: {
                        "Prefer": "return=representation"
                    },
                    body: JSON.stringify({
                        completed: !task.completed
                    })
                }
            );

            showMessage("Task status updated!");
            await loadTasks();
        }

    } catch (error) {
        showMessage("Operation failed: " + error.message, true);
    }
});

// Load Supabase configuration
async function initializeApp() {
    try {
        const response = await fetch("./config.json");

        if (!response.ok) {
            throw new Error("Could not load config.json");
        }

        const config = await response.json();

        supabaseUrl = config.supabaseUrl.replace(/\/+$/, "");
        supabaseKey = config.supabasePublishableKey;
        tableName = config.tableName;

        if (!supabaseUrl || !supabaseKey || tableName !== "tasks") {
            throw new Error("Please check your Supabase configuration.");
        }

        await loadTasks();

    } catch (error) {
        showMessage("Application initialization failed: " + error.message, true);
    }
}

// Start application
initializeApp();
