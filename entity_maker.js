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
        this.form = document.createElement("form")
        this.form.id = this.name
        this.form.classList.add("editorForm")
        this.domElement.appendChild(this.form)
        // 
        this.form.appendChild(this._make_header())
        // 
        for (const prop of this.properties) {
            this._clean_property_config(prop)
            this._make_input_row(prop)
        }
        // 
        _add_entity_class(this)
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
        if (prop["type"] != "float" && prop["type"] != "int") {
            console.assert(prop["min"] === undefined)
            console.assert(prop["max"] === undefined)
            console.assert(prop["step"] === undefined)
        }
        if (prop["type"] == "enum") {
            console.assert(prop["values"] !== undefined)
        }
        else {
            console.assert(prop["values"] === undefined)
        }
        if (prop["type"] == "entity") {
            console.assert(prop["targets"] !== undefined)
        }
        else {
            console.assert(prop["targets"] === undefined)
        }
        if (prop["type"] != "entity" && prop["type"] != "file") {
            console.assert(prop["multiple"] === undefined)
        }
        if (prop["type"] != "file") {
            console.assert(prop["accept"] === undefined)
        }
        // Check default value is valid
        if (prop["type"] == "float" || prop["type"] == "int") {
            console.assert(prop["default"] !== undefined)
            console.assert(Number.isFinite(prop["default"]))
            if (prop["min"] !== undefined) { console.assert(prop["default"] >= prop["min"]) }
            if (prop["max"] !== undefined) { console.assert(prop["default"] <= prop["max"]) }
        }
        else if (prop["type"] == "bool") {
            console.assert(prop["default"] !== undefined)
        }
        else if (prop["type"] == "enum") {
            console.assert(prop["default"] !== undefined)
            console.assert(prop["values"].find(prop["default"]))
        }
        else {
            console.assert(prop["default"] === undefined)
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
        this.form.appendChild(label)
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
            this.form.appendChild(document.createElement("div"))
            this.form.appendChild(document.createElement("div"))
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
        this.form.appendChild(input)

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
        this.form.appendChild(output)
    }

    _make_number(prop) {
        const input = this._make_input_node(prop)
        input.type = "number"
        input.min = prop["min"]
        input.max = prop["max"]
        input.step = prop["step"]
        input.value = prop["default"]
        this.form.appendChild(input)

        // 
        this.form.appendChild(this._make_units_node(prop))
    }

    _make_checkbox(prop) {
        const input = this._make_input_node(prop)
        input.type = "checkbox"
        input.checked = prop["default"]
        this.form.appendChild(input)

        // 
        this.form.appendChild(this._make_units_node(prop))
    }

    _make_radio_butons(prop) {
        const input = this._make_input_node(prop)
        input.type = "radio"

        for (option of prop["values"]) {
            // 
            const radio_button = document.createElement("")
        }

        // TODO

        this.form.appendChild(this._make_units_node(prop))
    }

    _make_file(prop) {
        // 
        const label = this.form.lastElementChild

        // The file input is hidden.
        const input = this._make_input_node(prop)
        input.type = "file"
        input.accept   = prop["accept"]
        input.multiple = prop["multiple"]
        this.form.appendChild(input)

        // Make a stylized button to replace the hidden input widget.
        const button = document.createElement("label")
        button.htmlFor = this._get_property_name(prop)
        button.innerText = "Select File"
        button.classList.add("inputFile")
        this.form.appendChild(button)

        // 
        const this_ = this
        input.addEventListener("change", () => {
            this_._file_callback(prop, input.files)
        });

        // 
        const output   = document.createElement("output")
        output.htmlFor = input.id
        prop["output"] = output
        this.form.appendChild(output)

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
        const this_ = this
        function drop(event) {
            stop_event(event)
            const dt = event.dataTransfer
            const files = dt.files
            this_._file_callback(prop, files)
        }
        element.addEventListener("dragenter", stop_event, false);
        element.addEventListener("dragover", stop_event, false);
        element.addEventListener("drop", drop, false);
    }

    _file_callback(prop, file_list) {
        prop["file"] = [] // List of file names
        prop["data"] = [] // List of file content blobs
        if (file_list.length == 0) {
            prop["output"].value = "No files selected"
            return
        }
        prop["output"].value = "Loading files ..."
        for (const file of file_list) {
            const reader = new FileReader()
            reader.onload = (event) => {
                prop["file"].push(file.name)
                prop["data"].push(event.target.result)
                prop["output"].value = prop["file"].join()
            }
            reader.readAsDataURL(file)
        }
    }

    _make_entity(prop) {
        const input = this._make_input_node(prop, "select")
        input.multiple = prop["multiple"]
        this.form.appendChild(input)

        this.form.appendChild(document.createElement("div")) // Third column placeholder.
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
            // Special case for files.
            if (prop["type"] == "file") {
                entity[name] = [[], []]
            }
            // Special case for entity cross references.
            else if (prop["type"] == "entity") {
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
            const name = prop["name"]
            const input = prop["input"]
            // Guard against missing / misconfigured properties.
            if (input === undefined) {
                continue
            }
            // Special case for checkboxes.
            else if (prop["type"] == "bool") {
                entity[name] = input.checked
            }
            // Special case for files.
            else if (prop["type"] == "file") {
                entity[name] = [prop["file"], prop["data"]]
            }
            // Special case for mutliple entity cross references.
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
        const defaults = this.get_defaults()
        for (const prop of this.properties) {
            const name  = prop["name"]
            const input = prop["input"]
            // Fill in the data object with default values as necessary.
            let value = entity[name]
            if (value === undefined) {
                value = defaults[name]
            }
            // Missing both regular value and default value.
            if (value === undefined) {
                continue
            }
            // 
            input.dispatchEvent(new InputEvent("beforeinput"))
            // Special case for checkboxes.
            if (prop["type"] == "bool") {
                input.checked = value
            }
            // Special case for files.
            else if (prop["type"] == "file") {
                const [file, data] = value
                prop["file"] = file
                prop["data"] = data
                prop["output"].value = file.join()
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
            // 
            input.dispatchEvent(new InputEvent("input"))
            input.dispatchEvent(new Event("change"))
        }
        // Update the title.
        const name = entity["name"]
        if (name) {
            this._title_element.innerText = `Edit ${this.title}: ${name}`
        }
        else {
            this._title_element.innerText = `Edit ${this.title}`
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
        console.assert(this.entity_configs)

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
            editor.domElement.addEventListener("input", (event) => {
                this._activate_change_hook()
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
                this._move_up()
            })

            const move_down = make_button("Move Down")
            move_down.addEventListener("click", () => {
                this._move_down()
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

    /// Modal dialog prompting the user for new a entity name.
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
        const name = this._get_selected_name()
        if (!name) {
            return
        }
        this._name_dialog_message.innerText = `Enter new name for "${name}"`
        this._name_dialog_callback = this._rename
        this._name_dialog.showModal()
    }

    // Button on-click callback.
    _ask_duplicate() {
        const name = this._get_selected_name()
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
        const name = this._get_selected_name()
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

    _select(index) {
        index = Math.round(index)
        if (index >= this._entities.length) {
            console.error(`Selected index out of bounds ${index}`)
            return
        }
        if (index < 0) {
            this._deselect()
            this._selected = index
            this._disable_buttons()
            return
        }
        if (this._selected < 0) {
            this._enable_buttons()
        }
        this._selected = index
        if (this._selected >= 0) {
            // Apply the CSS style class.
            this._entity_list.children[this._selected].classList.add("managerEntityButtonSelected")
            // Populate and display the appropriate entity editor.
            const entity        = this._entities[this._selected]
            const entity_editor = this._entity_editors[entity["type"]]
            entity_editor.set_data(entity)
            entity_editor.domElement.style.display = ""
            // Notify the user via the optional callback hook.
            for (const callback of this.select_hooks) {
                callback(entity)
            }
        }
    }

    // Returns the previously selected entity.
    _deselect() {
        if (this._selected >= 0) {
            // Clear the CSS style class.
            this._entity_list.children[this._selected].classList.remove("managerEntityButtonSelected")
            // Gather the latest data from the entity editor before it's gone.
            const entity = this.get_selected()
            this._selected = -1
            // Hide the entity editor.
            const entity_editor = this._entity_editors[entity["type"]]
            entity_editor.domElement.style.display = "none"
            // Notify the user via the optional callback hook.
            for (const callback of this.deselect_hooks) {
                callback(entity)
            }
            return entity
        }
    }

    // Notify the user that an entity's value changed via the optional callback hook.
    _activate_change_hook() {
        if (this.change_hooks.length) {
            const entity = this.get_selected()
            for (const callback of this.change_hooks) {
                callback(entity)
            }
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
    // This does *not* pull the latest data from the entity editor.
    _get_selected_name() {
        if (this._selected >= 0) {
            return this._entities[this._selected]["name"]
        }
    }

    // Select an entity by its index in the entity list.
    select_index(index) {
        index = Math.round(index)
        if (index != this._selected) {
            this._deselect()
            this._select(index)
        }
    }

    // Select the named entity.
    select_name(name) {
        for (const index in this._entities) {
            if (this._entities[index]["name"] == name) {
                this.select_index(index)
                return
            }
        }
        console.error(`No such entity ${name}`)
    }

    // Returns a copy of the entire entity list, including any modifications
    // currently being made by the editor.
    get_data() {
        this.get_selected() // Update our internal data from the editor's form.
        return Array.from(this._entities)
    }

    // Set the entity list to the given list of entity objects.
    // This discards any existing data in the entity manager.
    set_data(entity_list) {
        this._deselect()
        this._disable_buttons()
        this._entities = entity_list ? Array.from(entity_list) : []
        this._make_selector()
        this._update_cross_references()
        // Notify the user via the optional callback hook.
        for (const callback of this.set_data_hooks) {
            callback()
        }
    }

    // Create a new entity with the given name.
    _create(entity_editor, name) {
        this._deselect()
        // Make a new entity with default values.
        const entity = entity_editor.get_defaults()
        entity["name"] = name
        entity["type"] = entity_editor.name
        // Insert the new item and select it.
        this._entities.push(entity)
        this._make_selector()
        this.select_name(name)
        this._update_cross_references()
        // Notify the user via the optional callback hook.
        for (const callback of this.create_hooks) {
            callback(entity)
        }
    }

    // Delete the currently selected entity.
    _delete() {
        // Notify the user via the optional callback hook. Do this before
        // actually deleting the object so that both the "get_selected()"
        // and "get_selected_index()" methods still work correctly.
        if (this.delete_hooks.length) {
            const entity = this.get_selected()
            if (entity) {
                for (const callback of this.delete_hooks) {
                    callback(entity)
                }
            }
        }
        const index = this._selected
        const entity = this._deselect()
        if (!entity) {
            return
        }
        this._entities.splice(index, 1)
        this._disable_buttons()
        this._make_selector()
        this._update_cross_references()
    }

    // Rename the currently selected entity to the given name.
    _rename(new_name) {
        new_name       = new_name.trim()
        const entity   = this._deselect()
        const old_name = entity["name"]
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
        // Notify the user via the optional callback hook.
        for (const callback of this.rename_hooks) {
            callback(old_name, new_name)
        }
        this.select_name(new_name)
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

    // Duplicate the currently selected entity, apply the given name.
    _duplicate(name) {
        const entity = this._deselect()
        // Make a new entity with default values.
        const duplicate = {... entity}
        duplicate["name"] = name
        // Insert the new item and select it.
        this._entities.push(duplicate)
        this._make_selector()
        this.select_name(name)
        this._update_cross_references()
        // Notify the user via the optional callback hook.
        for (const callback of this.create_hooks) {
            callback(duplicate)
        }
    }

    // Button on-click callback.
    _move_up() {
        if (this._selected < 1) {
            return
        }
        // Swap the selected item up one row.
        const index = this._selected
        const swap  = index - 1
        const tmp   = this._entities[swap]
        this._entities[swap] = this._entities[index]
        this._entities[index] = tmp
        // 
        this._selected -= 1
        this._make_selector()
        this._update_cross_references()

        // Notify the user via the optional callback hook.
        const entity = this.get_selected()
        for (const callback of this.move_hooks) {
            callback(swap, index)
        }
    }

    // Button on-click callback.
    _move_down() {
        if (this._selected < 0) {
            return
        }
        if (this._selected + 1 >= this._entities.length) {
            return
        }
        // Swap the selected item down one row.
        const index = this._selected
        const swap  = index + 1
        const tmp   = this._entities[swap]
        this._entities[swap] = this._entities[index]
        this._entities[index] = tmp
        // 
        this._selected += 1
        this._make_selector()
        this._update_cross_references()

        // Notify the user via the optional callback hook.
        const entity = this.get_selected()
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
    // Check for duplicate names.
    for (const entity_class of Object.values(_entity_classes)) {
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
}

export { EntityEditor, EntityManager, get_data, set_data }

// TODO: Implement "enum" type properties, use radio buttons.

// TODO: Consider deep-copying all data at the API boundary to prevent users
//       from corrupting the entity-maker's internal data.

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
//     -> Make the undo feature configurable, user sets the undo stack size,
//        size zero disables the undo feature entirely.
//     -> Expose API global-functions for "undo()" and "redo()"
//     -> Expose pre-built undo & redo buttons.

// TODO: Keyboard shortcuts:
//     -> Arrow keys to selected different entity.
//     -> Ctrl-Arrow keys to move selected entity.
//     -> Delete key to delete selected entity.
//     -> Ctrl-R to rename selected entity.
