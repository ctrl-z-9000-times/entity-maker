// Copyright (c) 2024 David McDougall
// Released under the MIT License

class EntityEditor {
    constructor(entity_config, manager=null) {
        // Unpack the entity's configuration data.
        this.name        = _get_name(entity_config)
        this.title       = _get_title(entity_config)
        this.description = _get_aliased(entity_config, "description", "desc")
        this.properties  = _get_aliased(entity_config, "properties",  "props")
        this.manager     = manager
        // Check for required fields.
        console.assert(this.name)
        console.assert(this.properties)

        // Build the HTML panel.
        this.domElement = document.createElement("div")
        this.domElement.classList.add("editor")
        // Put the input widgets into an HTML form.
        this._form = document.createElement("form")
        this._form.id = this.name
        this._form.classList.add("editorForm")
        this.domElement.appendChild(this._form)
        // 
        this._form.appendChild(this._make_header())
        // 
        for (const prop of this.properties) {
            this._clean_property_config(prop)
            this._make_input_row(prop)
        }
        // Register this class, globally.
        _add_entity_class(this)
        // Setup callbacks for undo/redo.
        if (!this.manager) {
            this.domElement.addEventListener("change", (event) => {
                if (event.isTrusted && _history_limit) {
                    _record_action({
                        class: this,
                        action: "change",
                        entity: this.get_data(),
                    })
                }
            })
        }
    }

    // Make a panel displaying this entity's title and description.
    // Returns the DOM element, but does *not* parent it.
    _make_header() {
        const header = document.createElement("div")
        header.classList.add("editorHeader")
        // 
        this._title_element = document.createElement("h2")
        this._title_element.classList.add("title")
        this._title_element.innerText = `Edit ${this.title}`
        header.appendChild(this._title_element)
        // 
        if (this.description) {
            const paragraph = document.createElement("p")
            paragraph.classList.add("description")
            paragraph.innerText = this.description
            header.appendChild(paragraph)
        }
        return header
    }

    _clean_property_config(prop) {
        // Normalize the "type" aliases.
        if (prop["type"] === undefined) {
            prop["type"] = "float"
        }
        prop["type"] = prop["type"].toLowerCase()
        if (prop["type"] == "integer") {
            prop["type"] = "int"
        }
        else if (prop["type"] == "real") {
            prop["type"] = "float"
        }
        else if (prop["type"] == "boolean") {
            prop["type"] = "bool"
        }
        else if (prop["type"] == "enumeration") {
            prop["type"] = "enum"
        }
        else if (prop["type"] == "filename") {
            prop["type"] = "file"
        }
        else if (prop["type"] == "xref" || prop["type"] == "crossreference") {
            prop["type"] = "entity"
        }
        // Check for valid property type.
        const all_types = ["float", "int", "bool", "enum", "file", "entity"]
        console.assert(all_types.includes(prop["type"]),
            "Unrecognized property type \"%s\", in \"%s:%s\"", prop["type"], this.name, prop["name"])
        // Normalize the abbreviations.
        _get_aliased(prop, "description", "desc")
        _get_aliased(prop, "min", "minimum")
        _get_aliased(prop, "max", "maximum")
        // Ensure that the default values have the correct data type.
        if (prop["default"] !== undefined) {
            prop["default"] = this._typecast_value(prop, prop["default"])
        }
        // Typecast parameters.
        if (prop["accept"] instanceof Array) {
            prop["accept"] = prop["accept"].join()
        }
        if (prop["multiple"] !== undefined) {
            prop["multiple"] = Boolean(prop["multiple"])
        }
        if (typeof prop["targets"] === 'string' || prop["targets"] instanceof String) {
            prop["targets"] = [prop["targets"]]
        }
        if (prop["min"]  !== undefined) { prop["min"]  = this._typecast_value(prop, prop["min"]) }
        if (prop["max"]  !== undefined) { prop["max"]  = this._typecast_value(prop, prop["max"]) }
        if (prop["step"] !== undefined) { prop["step"] = this._typecast_value(prop, prop["step"]) }
        // Check for valid name and check for reserved names.
        console.assert(prop["name"])
        console.assert(prop["name"] == prop["name"].trim())
        console.assert(prop["name"] != "name")
        console.assert(prop["name"] != "type")
        // Check for required fields & invalid field combinations.
        const assert_present = (prop, field) => {
            console.assert(prop[field] !== undefined, "Missing attribute \"%s\" on \"%s:%s\"", field, this.name, prop["name"])
        }
        const assert_missing = (prop, field) => {
            console.assert(prop[field] === undefined, "Unexpected attribute \"%s\" on \"%s:%s\"", field, this.name, prop["name"])
        }
        if (prop["type"] != "float" && prop["type"] != "int") {
            assert_missing(prop, "min")
            assert_missing(prop, "max")
            assert_missing(prop, "step")
        }
        if (prop["type"] == "enum") {
            assert_present(prop, "values")
        }
        else {
            assert_missing(prop, "values")
        }
        if (prop["type"] == "entity") {
            assert_present(prop, "targets")
        }
        else {
            assert_missing(prop, "targets")
        }
        if (prop["type"] != "entity" && prop["type"] != "file") {
            assert_missing(prop, "multiple")
        }
        if (prop["type"] != "file") {
            assert_missing(prop, "accept")
        }
        // Check default value is valid
        if (prop["type"] == "float" || prop["type"] == "int") {
            assert_present(prop, "default")
            console.assert(Number.isFinite(prop["default"]))
            if (prop["min"] !== undefined) { console.assert(prop["default"] >= prop["min"]) }
            if (prop["max"] !== undefined) { console.assert(prop["default"] <= prop["max"]) }
        }
        else if (prop["type"] == "bool") {
            assert_present(prop, "default")
        }
        else if (prop["type"] == "enum") {
            assert_present(prop, "default")
            console.assert(prop["values"].find(prop["default"]))
        }
        else {
            assert_missing(prop, "default")
        }
    }

    _typecast_value(prop, value) {
        if (prop["type"] == "float") {
            return parseFloat(value)
        }
        else if (prop["type"] == "int") {
            return Math.round(parseFloat(value))
        }
        else if (prop["type"] == "bool") {
            return Boolean(value)
        }
        else if (prop["type"] == "enum") {
            return String(value)
        }
        else {
            return value
        }
    }

    _make_input_row(prop) {
        // Make labels for every input.
        const title = _get_title(prop)
        const label = document.createElement("label")
        label.htmlFor = this._get_property_name(prop)
        label.innerText = title
        label.classList.add("title")
        this._form.appendChild(label)
        // Make tool-tips over the labels with the property descriptions.
        if (prop["description"]) {
            const tooltip = document.createElement("span")
            tooltip.classList.add("tooltip")
            tooltip.innerText = prop["description"]
            label.prepend(tooltip)
        }
        // Make the input widgets.
        if (prop["min"] !== undefined && prop["max"] !== undefined) {
            this._make_slider(prop)
        }
        else if (prop["type"] == "float" || prop["type"] == "int") {
            this._make_number(prop)
        }
        else if (prop["type"] == "bool") {
            this._make_checkbox(prop)
        }
        // else if (prop["type"] == "enum") {
        //     this._make_radio_butons(prop)
        // }
        else if (prop["type"] == "file") {
            this._make_file(prop)
        }
        else if (prop["type"] == "entity") {
            this._make_entity(prop)
        }
        else {
            console.warn("Unrecognized value type " + prop["type"])
            // Make two empty div's to complete the row.
            this._form.appendChild(document.createElement("div"))
            this._form.appendChild(document.createElement("div"))
        }
    }

    // Combine the entity type name with the property name to make a globally unique ID.
    _get_property_name(prop) {
        return this.name + "_" + prop["name"]
    }

    // Make a new <input> element for this form.
    // Returns the DOM-node, does *not* parent it to the form.
    _make_input_node(prop, type="input") {
        const input = document.createElement(type)
        input.id = this._get_property_name(prop)
        prop["input"] = input
        return input
    }

    // Make a new <p> element showing this properties physical units.
    _make_units_node(prop) {
        const units = document.createElement("p")
        if (prop["units"]) {
            units.innerText = prop["units"]
        }
        return units
    }

    _make_slider(prop) {
        const input = this._make_input_node(prop)
        input.type = "range"
        input.min = prop["min"]
        input.max = prop["max"]
        input.step = prop["step"]
        input.value = prop["default"]
        this._form.appendChild(input)

        // Display the current value and physical units in the third column.
        const output   = document.createElement("output")
        output.htmlFor = input.id
        function update_output_label() {
            let label = String(input.value)
            if (prop["units"]) {
                label += " " + prop["units"]
            }
            output.value = label
        }
        update_output_label()
        input.addEventListener("input", update_output_label)
        this._form.appendChild(output)
    }

    _make_number(prop) {
        const input = this._make_input_node(prop)
        input.type = "number"
        input.min = prop["min"]
        input.max = prop["max"]
        input.step = prop["step"]
        input.value = prop["default"]
        this._form.appendChild(input)

        // 
        this._form.appendChild(this._make_units_node(prop))
    }

    _make_checkbox(prop) {
        const input = this._make_input_node(prop)
        input.type = "checkbox"
        input.checked = prop["default"]
        this._form.appendChild(input)

        // 
        this._form.appendChild(this._make_units_node(prop))
    }

    _make_radio_butons(prop) {
        const input = this._make_input_node(prop)
        input.type = "radio"

        for (option of prop["values"]) {
            // 
            const radio_button = document.createElement("")
        }

        // TODO

        this._form.appendChild(this._make_units_node(prop))
    }

    _make_file(prop) {
        // List of pairs of [file-name, content-blob]
        prop["value"] = []

        // 
        const label = this._form.lastElementChild

        // The file input is hidden.
        const input = this._make_input_node(prop)
        input.type = "file"
        input.accept   = prop["accept"]
        input.multiple = prop["multiple"]
        this._form.appendChild(input)

        // Make a stylized button to replace the hidden input widget.
        const button = document.createElement("label")
        button.htmlFor = this._get_property_name(prop)
        button.innerText = "Select File"
        button.classList.add("inputFile")
        this._form.appendChild(button)

        // 
        input.addEventListener("change", () => {
            this._file_callback(prop, input.files)
        });

        // 
        const output   = document.createElement("output")
        output.htmlFor = input.id
        prop["output"] = output
        this._form.appendChild(output)

        this._install_drag_and_drop(label,  prop)
        this._install_drag_and_drop(button, prop)
        this._install_drag_and_drop(output, prop)
    }

    _install_drag_and_drop(element, prop) {
        // https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications#selecting_files_using_drag_and_drop
        function stop_event(event) {
            event.stopPropagation()
            event.preventDefault()
        }
        const drop = (event) => {
            stop_event(event)
            this._file_callback(prop, event.dataTransfer.files)
        }
        element.addEventListener("dragenter", stop_event, false);
        element.addEventListener("dragover", stop_event, false);
        element.addEventListener("drop", drop, false);
    }

    _file_callback(prop, file_list) {
        // Setup storaget for the property's value.
        file_list = Array.from(file_list)
        prop["value"] = file_list.map((file) => [file.name, null])
        // Read the files.
        for (let index = 0; index < file_list.length; index++) {
            const reader = new FileReader()
            reader.onload = (event) => {
                prop["value"][index][1] = event.target.result
                this._update_file_status_message(prop)
                prop["input"].dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true }))
            }
            const file = file_list[index]
            reader.readAsDataURL(file)
        }
    }

    // Update the file-input status message.
    _update_file_status_message(prop) {
        const value    = prop["value"]
        const output   = prop["output"]
        const multiple = prop["multiple"]
        // 
        if (value.length == 0) {
            if (multiple) {
                output.value = "No files selected"
            }
            else {
                output.value = "No file selected"
            }
        }
        else if (value.some(([filename, blob]) => blob === null)) {
            if (multiple) {
                output.value = "Loading files ..."
            }
            else {
                output.value = "Loading file ..."
            }
        }
        else {
            output.value = value.map(([filename, blob]) => filename).join(", ")
        }
    }

    _make_entity(prop) {
        const input = this._make_input_node(prop, "select")
        input.multiple = prop["multiple"]
        this._form.appendChild(input)

        this._form.appendChild(document.createElement("div")) // Third column placeholder.
    }

    _deselect_all_entities(prop) {
        const input = prop["input"]
        for (const option of input.options) {
            option.selected = false
        }
    }

    _get_option(prop, name) {
        const input = prop["input"]
        for (const option of input.options) {
            if (option.value == name) {
                return option
            }
        }
    }

    // Rebuild the entity list based DOM elements.
    _update_entity_list(prop) {
        const input = prop["input"]
        const selected = Array.from(input.selectedOptions).map((option) => option.value)
        // Clear out all of the options.
        while (input.length) {
            input.remove(input.length - 1)
        }
        // Add the correct options to the selector.
        for (const entity_type of prop["targets"]) {
            const entity_class = _entity_classes[entity_type]
            // 
            if (entity_class === undefined) {
                console.warn(`Non-existent target: ${this.name}.${prop.name} -> ${entity_type}`)
            }
            // 
            else if (entity_class instanceof EntityManager) {
                for (const entity of entity_class._entities) {
                    input.add(new Option(entity["name"]))
                }
            }
            // 
            else if (entity_class instanceof EntityEditor) {
                input.add(new Option(entity_class.name))
            }
        }
        // Re-select the previously selected options.
        for (const value of selected) {
            const option = this._get_option(prop, value)
            if (option) { // Guard against deleted entities.
                option.selected = true
            }
        }
    }

    // Register all cross references from this entity to other entities (implicitly contained in entity managers).
    _register_cross_references(entity_manager) {
        for (const prop of this.properties) {
            if (prop["type"] == "entity") {
                if (prop["targets"].find((target) => entity_manager.name == target)) {
                    entity_manager._references.push([this, prop])
                }
            }
        }
    }

    // Update the entity list for the currently displayed entity.
    _rename_callback(old_name, new_name) {
        for (const prop of this.properties) {
            if (prop["type"] == "entity") {
                const old_option = this._get_option(prop, old_name)
                if (!old_option) {
                    return
                }
                const new_option    = new Option(new_name)
                new_option.selected = old_option.selected
                prop["input"].replaceChild(new_option, old_option)
            }
        }
    }

    // Get a new entity object populated with default values.
    get_defaults() {
        const entity = {type: this.name}
        for (const prop of this.properties) {
            const name = prop["name"]
            // Guard against misconfigured properties.
            if (!name) {
                continue
            }
            // Special case for files and entity cross references.
            if (prop["type"] == "file" || prop["type"] == "entity") {
                if (prop["multiple"]) {
                    entity[name] = []
                }
                else {
                    entity[name] = null
                }
            }
            // 
            else {
                entity[name] = prop["default"]
            }
        }
        return entity
    }

    // Get a new entity object populated with the currently displayed data.
    get_data() {
        const entity = this.get_defaults()
        for (const prop of this.properties) {
            const name  = prop["name"]
            const input = prop["input"]
            // Guard against missing / misconfigured properties.
            if (!name || !input) {
                continue
            }
            // Special case for checkboxes.
            else if (prop["type"] == "bool") {
                entity[name] = input.checked
            }
            // Special case for files.
            else if (prop["type"] == "file") {
                if (prop["multiple"]) {
                    entity[name] = prop["value"].map((pair) => Array.from(pair)) // Shallow copy to protect internal data structures.
                }
                else {
                    if (prop["value"].length > 0) {
                        entity[name] = Array.from(prop["value"][0])
                    }
                    else {
                        entity[name] = null
                    }
                }
            }
            // Special case for multiple entity cross references.
            else if (prop["type"] == "entity" && prop["multiple"]) {
                entity[name] = Array.from(input.selectedOptions).map((option) => option.value)
            }
            // Regular input fields: slider, number, single-entity.
            else {
                // If the input field is empty then return the default value.
                const value = input.value.trim()
                if (value === "") {
                    continue
                }
                // Cast the value to the correct data type.
                entity[name] = this._typecast_value(prop, value)
            }
        }
        return entity
    }

    // Set the form's input values using the given entity object.
    // Missing fields are filled in with their default value.
    // If the argument is missing then this resets the entire form to its default state.
    set_data(entity = {}) {
        // Emit all before-input events before updating any of the form.
        for (const prop of this.properties) {
            const input = prop["input"]
            if (input) {
                input.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true }))
            }
        }
        const defaults = this.get_defaults()
        for (const prop of this.properties) {
            const name  = prop["name"]
            const input = prop["input"]
            // Guard against missing / misconfigured properties.
            if (!name || !input) {
                continue
            }
            // Fill in the data object with default values as necessary.
            let value = entity[name]
            if (value === undefined) {
                value = defaults[name]
            }
            // Missing both regular value and default value.
            if (value === undefined) {
                continue
            }
            // Special case for checkboxes.
            if (prop["type"] == "bool") {
                input.checked = value
            }
            // Special case for files.
            else if (prop["type"] == "file") {
                if (!value) {
                    prop["value"] = []
                }
                else if (prop["multiple"]) {
                    prop["value"] = value
                }
                else {
                    prop["value"] = [value]
                }
                this._update_file_status_message(prop)
            }
            // Special case for entity cross references.
            else if (prop["type"] == "entity") {
                this._deselect_all_entities(prop)
                if (value instanceof Array) {
                    for (const xref of value) {
                        const option = this._get_option(prop, xref)
                        if (option) {
                            option.selected = true
                        }
                    }
                }
                else {
                    const option = this._get_option(prop, value)
                    if (option) {
                        options.selected = true
                    }
                }
            }
            // Regular input fields: slider, number.
            else {
                input.value = value
            }
        }
        // Update the title.
        const name = entity["name"]
        if (name) {
            this._title_element.innerText = `Edit ${this.title}: ${name}`
        }
        else {
            this._title_element.innerText = `Edit ${this.title}`
        }
        // Emit the input-change events after updating the entire form.
        for (const prop of this.properties) {
            const input = prop["input"]
            if (input) {
                input.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true }))
                input.dispatchEvent(new Event("change",     { bubbles: true, cancelable: true }))
            }
        }
    }

    // Enable the entire form.
    enable() {
        for (const prop of this.properties) {
            prop["input"].disabled = false
        }
    }

    // Disable the entire form.
    disable() {
        for (const prop of this.properties) {
            prop["input"].disabled = true
        }
    }
}

class EntityManager {
    constructor(manager_config) {
        // Unpack the entity's configuration data.
        this.name            = _get_name(manager_config)
        this.title           = _get_title(manager_config)
        this.description     = _get_aliased(manager_config, "description", "desc")
        this.entity_configs  = _get_aliased(manager_config, "entities", "contents")
        this.keep_sorted     = _get_aliased(manager_config, "keep_sorted", "sorted", "sort")
        this._entity_editors = {}
        // Maintain a list of all cross references to this manager's entities.
        // Contains pairs of (EntityEditor, prop). By definition: props will "entity" type properties.
        this._references     = []
        // Public callback hook lists:
        this.select_hooks   = []
        this.deselect_hooks = []
        this.set_data_hooks = []
        this.create_hooks   = []
        this.change_hooks   = []
        this.rename_hooks   = []
        this.move_hooks     = []
        this.delete_hooks   = []
        // Check for required fields.
        console.assert(this.name)
        console.assert(this.entity_configs && this.entity_configs.length)

        // Setup the internal data structures.
        this._entities = []
        this._selected = -1

        // Build the HTML panel.
        this.domElement = document.createElement("div")
        this.domElement.classList.add("manager")
        this._control_div = document.createElement("div")
        this.domElement.appendChild(this._control_div)

        // Make editor panels for each entity type and append them to the main "domElement".
        for (const entity_config of this.entity_configs) {
            const editor = new EntityEditor(entity_config, this)
            this._entity_editors[editor.name] = editor
            editor.domElement.style.display = "none"
            editor.domElement.addEventListener("change", (event) => {
                if (event.isTrusted) {
                    this._activate_change_hook()
                }
            })
            this.domElement.appendChild(editor.domElement)
        }

        this._make_header()
        this._make_buttons()
        this._disable_buttons() // Initially nothing is selected, so disable the management buttons.
        this._make_name_dialog()
        this._make_delete_dialog()

        // Setup the entity list.
        this._entity_list = document.createElement("div")
        this._entity_list.classList.add("managerEntityList")
        this._control_div.appendChild(this._entity_list)
        this._make_selector()
        // 
        _add_entity_class(this)
    }

    // Make a panel displaying this entity's title and description.
    _make_header() {
        const header = document.createElement("div")
        // 
        const title = document.createElement("h2")
        title.classList.add("title")
        title.innerText = this.title
        header.appendChild(title)
        // 
        if (this.description) {
            const paragraph = document.createElement("p")
            paragraph.classList.add("description")
            paragraph.innerText = this.description
            header.appendChild(paragraph)
        }
        this._control_div.appendChild(header)
    }

    // Setup a panel with the standard management control buttons and input fields.
    _make_buttons() {
        this._button_div = document.createElement("div")
        this._button_div.classList.add("managerButtonDiv")
        this._control_div.appendChild(this._button_div)

        const make_button = (label) => {
            const button = document.createElement("button")
            button.innerText = label
            button.classList.add("managerButton")
            this._button_div.appendChild(button)
            return button
        }

        for (const entity_editor of Object.values(this._entity_editors)) {
            const create = make_button("New " + entity_editor.title)
            create.addEventListener("click", () => {
                this._ask_new_name(entity_editor)
            })
        }

        const rename = make_button("Rename")
        rename.addEventListener("click", () => {
            this._ask_rename()
        })

        const duplicate = make_button("Duplicate")
        duplicate.addEventListener("click", () => {
            this._ask_duplicate()
        })

        const remove = make_button("Delete")
        remove.addEventListener("click", () => {
            this._ask_delete()
        })

        // These buttons modify existing entities, so they're only enabled if an
        // entity is currently selected. 
        this._control_buttons = [rename, duplicate, remove]

        if (!this.keep_sorted) {
            const move_up = make_button("Move Up")
            move_up.addEventListener("click", () => {
                this._move(-1)
            })

            const move_down = make_button("Move Down")
            move_down.addEventListener("click", () => {
                this._move(+1)
            })

            this._control_buttons.push(move_up)
            this._control_buttons.push(move_down)
        }
    }

    _enable_buttons() {
        for (const button of this._control_buttons) {
            button.disabled = false
        }
    }

    _disable_buttons() {
        for (const button of this._control_buttons) {
            button.disabled = true
        }
    }

    // Modal dialog prompting the user for new a entity name.
    _make_name_dialog() {
        this._name_dialog = document.createElement("dialog")
        // 
        const form  = document.createElement("form")
        form.method = "dialog"
        form.name   = "name_form"
        // The prompt message is generated when the dialog opens.
        this._name_dialog_message = document.createElement("p")
        // 
        const name       = document.createElement("input")
        name.type        = "text"
        name.name        = "name"
        name.placeholder = "entity name"
        name.minLength   = 1
        name.required    = true
        name.autofocus   = true
        name.addEventListener("input", (event) => {
            name.setCustomValidity(_validate_entity_name(name.value))
        })
        // 
        const button_row = document.createElement("div")
        const enter = document.createElement("input")
        enter.type  = "submit"
        enter.value = "Ok"
        // 
        const cancel = document.createElement("input")
        cancel.value = "Cancel"
        cancel.type  = "reset"
        cancel.addEventListener("click", () => {
            this._name_dialog.close()
        })
        // 
        this._name_dialog_callback = (name) => {}
        form.addEventListener("submit", () => {
            this._name_dialog_callback(name.value.trim())
            this._name_dialog.close()
        })
        // Always clear the form's data when the dialog closes.
        this._name_dialog.addEventListener("close", () => {
            form.reset()
        })
        // 
        this.domElement.appendChild(this._name_dialog)
        this._name_dialog.appendChild(form)
        form.appendChild(this._name_dialog_message)
        form.appendChild(name)
        form.appendChild(button_row)
        button_row.appendChild(enter)
        button_row.appendChild(cancel)
    }

    // Button on-click callback.
    _ask_new_name(entity_editor) {
        this._name_dialog_message.innerText = `Enter name for new ${entity_editor.name}`
        this._name_dialog_callback = (name) => {
            this._create(entity_editor, name)
        }
        this._name_dialog.showModal()
    }

    // Button on-click callback.
    _ask_rename() {
        const name = this.get_selected_name()
        if (!name) {
            return
        }
        this._name_dialog_message.innerText = `Enter new name for "${name}"`
        this._name_dialog_callback = this._rename
        this._name_dialog.showModal()
    }

    // Button on-click callback.
    _ask_duplicate() {
        const name = this.get_selected_name()
        if (!name) {
            return
        }
        this._name_dialog_message.innerText = `Enter name for duplicate "${name}"`
        this._name_dialog_callback = this._duplicate
        this._name_dialog.showModal()
    }

    _make_delete_dialog() {
        this._delete_dialog = document.createElement("dialog")
        // 
        const form  = document.createElement("form")
        form.method = "dialog"
        form.name   = "confirm_delete"
        // The prompt message is generated when the dialog opens.
        this._delete_dialog_message = document.createElement("p")
        // 
        const enter = document.createElement("input")
        enter.type  = "submit"
        enter.value = "Ok"
        enter.autofocus = true
        // 
        const cancel = document.createElement("input")
        cancel.value = "Cancel"
        cancel.type  = "reset"
        cancel.addEventListener("click", () => {
            this._delete_dialog.close()
        })
        // 
        form.addEventListener("submit", () => {
            this._delete()
            this._delete_dialog.close()
        })
        // 
        this.domElement.appendChild(this._delete_dialog)
        this._delete_dialog.appendChild(form)
        form.appendChild(this._delete_dialog_message)
        form.appendChild(enter)
        form.appendChild(cancel)
    }

    // Button on-click callback.
    _ask_delete() {
        const name = this.get_selected_name()
        if (!name) {
            return
        }
        this._delete_dialog_message.innerText = `Confirm delete "${name}"?`
        this._delete_dialog.showModal()
    }

    _make_selector() {
        // Sort the entities.
        if (this.keep_sorted) {
            if (typeof this.keep_sorted == 'function') {
                this._entities.sort((a, b) => this.keep_sorted)
            }
            else {
                this._entities.sort((a, b) => (a.name < b.name ? -1 : 1))
            }
        }
        // Remove all existing buttons.
        while (this._entity_list.lastChild) {
            this._entity_list.removeChild(this._entity_list.lastChild)
        }
        // Create new buttons.
        for (const [index, entity] of this._entities.entries()) {
            const button = document.createElement('button')
            button.innerText = entity["name"]
            button.classList.add("managerEntityButton")
            button.addEventListener("click", () => {
                this.select_index(index)
            })
            this._entity_list.appendChild(button)
        }
        // Apply selected styling.
        if (this._selected >= 0) {
            this._entity_list.children[this._selected].classList.add("managerEntityButtonSelected")
        }
        // Hide the selector if there is nothing in it.
        if (!this._entities.length) {
            this._entity_list.style.display = "none"
        }
        else {
            this._entity_list.style.display = "" // Reset the style to the style-sheet's value.
        }
    }

    // Select an entity by its index in the entity list.
    select_index(index) {
        index = Math.round(index)
        if (index == this._selected) {
            return
        }
        const prev_selected = this._selected >= 0
        this._deselect()
        if (index >= this._entities.length) {
            console.error("Selected index out of bounds %s", index)
            return
        }
        this._selected = index
        if (this._selected < 0) {
            this._disable_buttons()
            return
        }
        if (!prev_selected) {
            this._enable_buttons()
        }
        // Apply the CSS style class.
        this._entity_list.children[this._selected].classList.add("managerEntityButtonSelected")
        // Populate and display the appropriate entity editor.
        const entity        = this._entities[this._selected]
        const entity_editor = this._entity_editors[entity["type"]]
        entity_editor.set_data(entity)
        entity_editor.domElement.style.display = ""
        // Notify the user via the optional callback hook.
        for (const callback of this.select_hooks) {
            callback(Object.assign({}, entity), this._selected)
        }
    }

    // Select the named entity.
    select_name(name) {
        const index = this.get_index(name)
        if (index === undefined) {
            console.error("No such entity %s", name)
        }
        else {
            this.select_index(index)
        }
    }

    // Returns the previously selected entity.
    _deselect() {
        if (this._selected >= 0) {
            // Clear the CSS style class.
            this._entity_list.children[this._selected].classList.remove("managerEntityButtonSelected")
            // Gather the latest data from the entity editor before it's gone.
            const entity   = this.get_selected()
            const index    = this._selected
            this._selected = -1
            // Hide the entity editor.
            const entity_editor = this._entity_editors[entity["type"]]
            entity_editor.domElement.style.display = "none"
            // Notify the user via the optional callback hook.
            for (const callback of this.deselect_hooks) {
                callback(Object.assign({}, entity), index)
            }
            return entity
        }
    }

    // Notify the user that an entity's value changed via the optional callback hook.
    _activate_change_hook() {
        const entity = this.get_selected()
        if (!entity) {
            return
        }
        for (const callback of this.change_hooks) {
            callback(Object.assign({}, entity), this._selected)
        }
    }

    // Call this whenever the list of entity names changes.
    _update_cross_references() {
        for (const [editor, prop] of this._references) {
            editor._update_entity_list(prop)
        }
    }

    // Returns the currently selected entity, or undefined if nothing is selected.
    get_selected() {
        // Gather the latest data about the currently selected entity from the entity editor.
        if (this._selected >= 0) {
            const entity        = this._entities[this._selected]
            const entity_editor = this._entity_editors[entity["type"]]
            // Assign in-place to the existing object so as to preserve extra fields.
            Object.assign(entity, entity_editor.get_data())
            return entity
        }
    }

    // Returns the index of the currently selected entity, or undefined if nothing is selected.
    get_selected_index() {
        if (this._selected >= 0) {
            return this._selected
        }
    }

    // Returns the name of the currently selected entity, or undefined if nothing is selected.
    get_selected_name() {
        if (this._selected >= 0) {
            return this._entities[this._selected]["name"]
        }
    }

    // Returns the index of the named entity, or undefined if it's not found within this manager.
    get_index(name) {
        const index = this._entities.findIndex((entity) => entity["name"] == name)
        if (index >= 0) {
            return index
        }
    }

    // Returns a copy of the entire entity list, including any modifications
    // currently being made by the editor.
    get_data() {
        // Update our internal data from the editor's form.
        this.get_selected()
        // If we alphabetized the entities then return them in a dictionary, indexed by entity name.
        if (this.keep_sorted && typeof this.keep_sorted != 'function') {
            return Object.fromEntries(this._entities.map((entity) => [entity.name, Object.assign({}, entity)]))
        }
        else {
            // Shallow copy the entities to protect our internal data structures.
            return this._entities.map((entity) => Object.assign({}, entity))
        }
    }

    // Set the entity list to the given list of entity objects.
    // This discards any existing data in the entity manager.
    set_data(entity_list) {
        this._deselect()
        this._disable_buttons()
        // Shallow copy the entities so that the user can't modify our internal data structures.
        if (entity_list instanceof Array) {
            this._entities = entity_list.map((entity) => Object.assign({}, entity))
        }
        else if(entity_list instanceof Object) {
            this._entities = Object.entries(entity_list).map(([attribute_name, entity]) => {
                entity = Object.assign({}, entity) // Shallow copy.
                const entity_name = entity["name"]
                if (entity_name === undefined) {
                    entity["name"] = attribute_name
                }
                else {
                    console.assert(attribute_name == entity_name)
                }
                return entity
            })
        }
        else {
            this._entities = []
        }
        // Discard entities with missing "name" or invalid "type" attributes.
        this._entities = this._entities.filter((entity) => {
            const name = entity["name"]
            console.assert(name, "Missing attribute \"name\" on %s entity", this.name)
            return name
        })
        const entity_types = this.entity_configs.map((entity_config) => entity_config.name)
        const entity_types_str = entity_types.join()
        this._entities = this._entities.filter((entity) => {
            const type = entity["type"]
            if (!type && entity_types.length == 1) {
                entity["type"] = entity_types[0]
                return true
            }
            console.assert(type, "Missing attribute \"type\" on %s entity \"%s\"", this.name, entity["name"])
            console.assert(entity_types.includes(type),
                "Invalid type \"%s\" on %s entity \"%s\" (expected one of: %s)",
                type, this.name, entity["name"], entity_types_str)
            return type && entity_types.includes(type)
        })
        // 
        this._make_selector()
        this._update_cross_references()
        // Notify the user via the optional callback hook.
        for (const callback of this.set_data_hooks) {
            callback(this._entities.map((entity) => Object.assign({}, entity)))
        }
    }

    // Returns the named entity, or undefined if it's not found within this manager.
    get_entity(name_or_index) {
        let index = undefined
        if (typeof name_or_index === 'string' || name_or_index instanceof String) {
            index = this._entities.findIndex((entity) => entity["name"] == name)
        }
        else {
            index = Math.round(name_or_index)
        }
        if (index == this._selected) {
            return this.get_selected()
        }
        else {
            return this._entities[index]
        }
    }

    /*
    //
    set_entity(entity, index=undefined) {
        // todo
    }
    */

    // Create a new entity with the given name and default values.
    _create(entity_editor, name) {
        this._deselect()
        // Make a new entity with default values.
        const entity   = entity_editor.get_defaults()
        entity["name"] = name
        entity["type"] = entity_editor.name

        this._add_entity(entity)
    }

    // Duplicate the currently selected entity, apply the given name.
    _duplicate(name) {
        const entity      = this._deselect()
        const duplicate   = {... entity}
        duplicate["name"] = name

        this._add_entity(entity)
    }

    _add_entity(entity, index=undefined, record_history=true) {
        this._deselect()
        // Insert the new item.
        if (index === undefined) {
            this._entities.push(entity)
        }
        else {
            this._entities.splice(index, 0, entity)
        }
        // Update the UI.
        this._make_selector()
        this._update_cross_references()
        index = this.get_index(entity["name"])
        // Record this action into the undo/redo history.
        if (_history_limit && record_history) {
            _record_action({
                class: this,
                type: "create",
                entity: Object.assign({}, entity),
                index: index,
            })
        }
        // Notify the user via the optional callback hook.
        for (const callback of this.create_hooks) {
            callback(Object.assign({}, entity), index)
        }
        // Select the new item after notifying the user of its existence.
        this.select_index(index)
    }

    // Delete the currently selected entity.
    _delete(index=undefined, record_history=true) {
        let entity = undefined
        if (index === undefined) {
            index  = this._selected
            entity = this._deselect()
        }
        else {
            this._deselect()
            entity = this._entities[index]
        }
        // Guard against nothing selected / invalid index.
        if (!entity) {
            return
        }
        this._entities.splice(index, 1)
        this._disable_buttons()
        this._make_selector()
        this._update_cross_references()
        // Record this action into the undo/redo history.
        if (_history_limit && record_history) {
            _record_action({
                class: this,
                action: "delete",
                entity: Object.assign({}, entity),
                index: index,
            })
        }
        // Notify the user via the optional callback hook.
        for (const callback of this.delete_hooks) {
            callback(Object.assign({}, entity), index)
        }
    }

    // Rename the currently selected entity to the given name.
    _rename(new_name, old_name=undefined, record_history=true) {
        new_name      = new_name.trim()
        let old_index = undefined
        let entity    = undefined
        if (old_name === undefined) {
            old_index = this._selected
            entity    = this._deselect()
            old_name  = entity["name"]
        }
        else {
            this._deselect()
            old_index = this.get_index(old_name)
            entity    = this._entities[old_index]
        }
        if (!entity || !new_name || old_name == new_name) {
            return
        }
        // Alter the name and reselect the entity.
        entity["name"] = new_name
        this._make_selector()
        // Update all references to the renamed entity.
        for (const entity_class of Object.values(_entity_classes)) {
            entity_class._rename_callback(old_name, new_name)
        }
        this._update_cross_references()
        const new_index = this.get_index(new_name)
        // Record this action into the undo/redo history.
        if (_history_limit && record_history) {
            _record_action({
                class: this,
                action: "rename",
                old_name: old_name,
                new_name: new_name,
            })
        }
        // Notify the user via the optional callback hook.
        for (const callback of this.rename_hooks) {
            callback(old_name, new_name, old_index, new_index)
        }
        this.select_index(new_index)
    }

    // Find and replace all cross references to a renamed entity.
    // This updates all of the underlying data stored in this EntityManager.
    _rename_callback(old_name, new_name) {
        for (const entity of this._entities) {
            const editor = this._entity_editors[entity["type"]]
            for (const prop of editor.properties) {
                if (prop["type"] != "entity") {
                    continue
                }
                const prop_name  = prop["name"]
                const prop_value = entity[prop_name]
                if (prop["multiple"]) {
                    for (const index in prop_value) {
                        if (prop_value[index] == old_name) {
                            prop_value[index] = new_name
                        }
                    }
                }
                else {
                    if (prop_value == old_name) {
                        entity[prop_name] = new_name
                    }
                }
            }
        }
    }

    // Button on-click callback.
    _move(direction, index=undefined, record_history=true) {
        if (index === undefined) {
            index = this._selected
            if (index < 0) {
                return
            }
        }
        else {
            this.select_index(index)
        }
        // Swap the selected item up/down one row.
        const swap = index + direction
        // Guard against swapping out of bounds.
        if (swap < 0 || swap >= this._entities.length) {
            return
        }
        // Perform the swap on the underlying data.
        const tmp = this._entities[swap]
        this._entities[swap]  = this._entities[index]
        this._entities[index] = tmp
        // Don't deselect/reselect, instead just modify the selected index.
        this._selected = swap
        this._make_selector()
        this._update_cross_references()
        // Record this action into the undo/redo history.
        if (_history_limit && record_history) {
            _record_action({
                class: this,
                action: "move",
                index: index,
                direction: direction,
            })
        }
        // Notify the user via the optional callback hook.
        for (const callback of this.move_hooks) {
            callback(index, swap)
        }
    }

    // Returns the EntityEditor object with the given name, or undefined if it's
    // not found within this manager.
    get_entity_editor(entity_type) {
        return this._entity_editors[entity_type]
    }
}

// Access and return an attribute using any of the given aliases.
// The value is also moved to the first alias.
function _get_aliased(config, ...aliases) {
    let match = undefined
    for (const alias of aliases) {
        if (match === undefined) {
            match = config[alias]
            delete config[alias]
        }
        else {
            // Error on duplicate equivalent keys.
            console.assert(config[alias] === undefined, config, alias)
        }
    }
    if (match !== undefined) {
        const primary = aliases[0]
        config[primary] = match
    }
    return match
}

function _get_name(config) {
    let name = config["name"]
    if (name !== undefined) {
        return name.trim()
    }
}

// Get the "title" attribute and fall back to the "name" if it's missing.
function _get_title(config) {
    let title = config["title"]
    if (title === undefined) {
        title = config["name"].trim().replaceAll("_", " ")
        config["title"] = title
    }
    // Capitalize the letter of every word in the title, and normalize the whitespace.
    return title.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// Disable the default drag-and-drop behavior of web-browsers to load the given file.
// The EntityEditor supports file drag-and-drop, but if the user misses the drop zone
// then it must *not* navigate to the dropped document.
function _preventDefault(e) { (e || event).preventDefault() }
window.addEventListener("dragenter", _preventDefault, false);
window.addEventListener("dragover",  _preventDefault, false);
window.addEventListener("drop",      _preventDefault, false);

// Global table of all EntityEditor's and EntityManager's, indexed by their internal name.
const _entity_classes = {}

function _all_editors() {
    return Object.values(_entity_classes).filter((entity_class) => entity_class instanceof EntityEditor)
}

function _all_managers() {
    return Object.values(_entity_classes).filter((entity_class) => entity_class instanceof EntityManager)
}

function _add_entity_class(entity_class) {
    console.assert(!_entity_classes[entity_class.name],
        `EntityEditor or EntityManager name conflict: "${entity_class.name}"`)
    _entity_classes[entity_class.name] = entity_class
    // Register callbacks.
    if (entity_class instanceof EntityEditor) {
        for (const manager of _all_managers()) {
            entity_class._register_cross_references(manager)
        }
    }
    else if (entity_class instanceof EntityManager) {
        for (const editor of _all_editors()) {
            editor._register_cross_references(entity_class)
        }
    }
}

// Returns a string message for input.setCustomValidity()
function _validate_entity_name(name) {
    name = name.trim()
    // Check for empty strings.
    if (name.length == 0) {
        return "required field"
    }
    // Check for reserved & duplicate names.
    for (const entity_class of Object.values(_entity_classes)) {
        if (entity_class.name == name) {
            return "reserved name"
        }
        if (entity_class instanceof EntityManager) {
            if (entity_class._entities.find((entity) => entity["name"] == name)) {
                return "duplicate name"
            }
        }
    }
    // Check for reserved characters.
    if (name.includes('"')) {
        return 'invalid character: "'
    }
    if (name.includes('\\')) {
        return 'invalid character: \\'
    }
    // Name is acceptable.
    return ""
}

// Get the current data from all EntityEditors and EntityManagers. The
// entity-maker keeps a global table of all instances of these two classes for
// this purpose. Returns a JSON string.
function get_data() {
    const data = {}
    for (const manager of _all_managers()) {
        data[manager.name] = manager.get_data()
    }
    // Gather from all entity editors which are not part of an entity manager.
    for (const editor of _all_editors()) {
        if (!editor.manager) {
            data[editor.name] = editor.get_data()
        }
    }
    return JSON.stringify(data)
}

// Set the data for all EntityEditors and EntityManagers, discarding any
// existing data. Accepts an object or JSON string. Missing data is filled in
// with default values. If no data is given then this resets the entire entity-maker.
// 
// This also clears the undo history buffer. Calling "set_data()" can not be undone.
function set_data(json) {
    if (json === undefined || json === null || json == "") {
        json = {}
    }
    else if (typeof json === 'string' || json instanceof String) {
        json = JSON.parse(json)
    }
    for (const [name, entity_class] of Object.entries(_entity_classes)) {
        entity_class.set_data(json[name])
    }
    clear_undo_history()
}

// 
function get_entity(name) {
    for (const entity_class of _entity_classes) {
        if (entity_class.name == name) {
            return entity_class
        }
        if (entity_class instanceof EntityManager) {
            const entity = entity_class.get_entity(name)
            if (entity) {
                return entity
            }
        }
    }
}

/*
// 
function set_entity(entity, index) {
    // todo
}
*/

// Keep track of the recent actions for undo/redo purposes.
const _history_buffer = []
const _history_limit  =  0
let   _history_cursor = -1

// Controls how many actions the user can undo at one time.
// Setting this to zero disables the undo/redo feature altogether.
function set_undo_limit(max_actions) {
    _history_limit = Math.max(0, Math.round(parseFloat(max_actions)))
    _discard_ancient_history()
}

// 
function clear_undo_history() {
    _history_buffer.splice(0)
    _history_cursor = -1
}

function _record_action(data) {
    if (!_history_limit) {
        return
    }
    // Truncate the history buffer at the cursor.
    if (_history_cursor < _history_buffer.length - 1) {
        _history_buffer.splice(_history_cursor + 1, Infinity)
    }
    // Append the new action.
    _history_buffer.push(data)
    _history_cursor += 1

    _discard_ancient_history()
}

// The history buffer only keeps a few recent actions for undo/redo.
function _discard_ancient_history() {
    // For efficiency, do this periodically instead of every action.
    if (_history_buffer.length > 1.25 * _history_limit) {
        _history_buffer.splice(0, _history_buffer.length - _history_limit)
        _history_cursor = _history_buffer.length - 1
    }
}

// 
function undo() {
    if (_history_cursor < 0) {
        return
    }
    action = _history_buffer[_history_cursor]
    action._undo()
    _history_cursor -= 1
}

// 
function redo() {
    if (_history_cursor + 1 >= _history_buffer.length) {
        return
    }
    _history_cursor += 1
    action = _history_buffer[_history_cursor]
    action._redo()
}

class Action {
    constructor(entity_class, action_type, entity, index) {
        this.class  = entity_class
        this.type   = action_type
        this.entity = entity
        this.index  = index
    }

    _undo() {
        if (this.type == "create") {
            this.class._delete(this.index, false)
        }
        else if (this.type == "delete") {
            this.class._add_entity(this.entity, this.index, false)
        }
        else if (this.type == "rename") {
            this.class._rename(this.old_name, this.new_name, false)
        }
        else if (this.type == "move") {
            this.class._move(-this.direction, this.index + this.direction, false)
        }
        else if (this.type == "change") {
            // TODO
        }
    }

    _redo() {
        if (this.type == "create") {
            this.class._add_entity(this.entity, this.index, false)
        }
        else if (this.type == "delete") {
            this.class._delete(this.index, false)
        }
        else if (this.type == "rename") {
            this.class._rename(this.new_name, this.old_name, false)
        }
        else if (this.type == "move") {
            this.class._move(this.direction, this.index, false)
        }
        else if (this.type == "change") {
            // TODO
        }
    }
}

export { EntityEditor, EntityManager, get_data, set_data, set_undo_limit, clear_undo_history, undo, redo }

// TODO: Implement "enum" type properties, use radio buttons.

// TODO: Search/filter entities by name.
//       -> If there is an active search, then simply disable the move-up/down buttons.
//           + Show a tooltip explaining why the move up/down buttons are disabled.
//       -> Search will need a clear-entry [X] button.
//       -> When search is cleared, will need to adjust scroll position so that
//          current selection is still visible in the window.
//       -> Make the searchbar configurable on each manager (show/hide).

// TODO: Implement an "undo" button to replace/compliment the confirm deletion
// dialog pop-up window.
//     -> When undo-ing things call the manager's methods so that the action
//        gets performed in the normal way and triggers the normal callback hooks.
//        Including de/selecting the entities.

// TODO: Make function to copy entities at the public API.
//     -> Currently this does not copy nested lists correctly (entity & file lists).
//     -> Use builtin function "structuredClone(X)" instead of "Object.assign({}, X)" ?

// TODO: Keyboard shortcuts:
//     -> Arrow keys to selected different entity.
//     -> Ctrl-Arrow keys to move selected entity.
//     -> Delete key to delete selected entity.
//     -> Ctrl-R to rename selected entity.
//     -> Ctrl-Z & Ctrl-Shift-Z to undo/redo.
