# Entity Maker #

Build user interfaces for managing custom entities

Complicated program often have a large number of user-defined parameters.
Furthermore the parameters are usually highly organized and constrained.
Providing a user-interface for managing such parameters is a non-trivial task.
To facilitate such activities, this library generates simple HTML forms based on
a static description of the parameters' data-structures.


## Example ##

![Example: User Interface from the Morphology Wizard](/morphology_wizard_example.avif)


## Installation ##

The framework consists of two files, which you should incorporate into your
project as appropriate:
* `entity_maker.js`
* `entity_maker.css`


## Usage ##

A typical workflow is as follows:

1) Define the static description of your data structures.

2) Instantiate the `EntityEditor` and/or `EntityManager` classes.

3) Insert their `domElement` properties into your user interface.

4) Call `set_data()` to load existing data into the forms.

5) Call `get_data()` to retrieve the state of the forms.


## Global Functions ##

* `get_data() -> JSON`  
Get the current data from all `EntityEditor` and `EntityManager` instances. The
entity-maker maintains a global table of all such instances for this purpose.
Returns a JSON string.

* `set_data(JSON)`  
Set the data for all `EntityEditor` and `EntityManager` instances, discarding
all previous data. Accepts an object or JSON string. Missing data is filled in
with default values. If no data is given then this resets the entire entity-maker.


## EntityEditor ##

The entity editor allow the user to edit the properties of a single entity.  
It groups together a list of input fields into a single cohesive settings menu.  

The `EntityEditor` class constructor accepts an object with the following fields:  

* `"name"`  
Required, this is the name of the entity type in the resulting entity list.  
EntityEditor and EntityManager names must be globally unique.

* `"title"`  
Optional flavor text.

* `"description"`  
Optional flavor text.

* `"properties"`  
Required, a list of entity property specifications.


### Entity Properties ###

Entity property widgets allow the user to input values into the program.  
Each property widget is specified by an object with the following fields:  

* `"name"`  
Required, this will be the name of the parameter in the resulting entity object.

* `"title"`  
Optional flavor text.

* `"description"`  
Optional flavor text.

* `"units"`  
Optional flavor text.

* `"type"`  
Must be one of: `"float"`, `"int"`, `"bool"`, `"enum"`, `"file"`, or `"entity"`.  
Optional string, default: `"float"`

* `"min"`  
Set a minimum acceptable value (inclusive).  
Optional number, only valid for "float" and "int" type properties.

* `"max"`  
Set a maximum acceptable values, (inclusive).  
Optional number, only valid for "float" and "int" type properties.

* `"step"`  
Optional number, default `1.0`

* `"default"`  
Default value for this property.  
Required and only valid for `"float"`, `"int"`, `"bool"`, and `"enum"` type properties.

* `"values"`  
List of options for "enum" type properties.  
Required and only valid for `"enum"` type properties.

* `"accept"`  
List of file type specifiers. File extensions should include the leading period.  
Optional, only valid for `"file"` type properties.  

* `"targets"`  
Specifies which entity types can be referenced by `"entity"` type property.  
Only valid for `"entity"` type properties.  
Required string or list of strings.

* `"multiple"`  
Can the user select multiple items?  
Only valid for `"entity"` and `"file"` type properties.  
Optional boolean, default `false`


#### Property Widget Types ####

If type is `"real"` or `"int"`:  
And both `"min"` and `"max"` are specified then this makes a slider widget,
otherwise this makes a spinner widget.

If type is `"enum"` then this makes a set of radio buttons.  
(**Unimplemented**)

If type is `"bool"` then this makes a checkbox.

If type is `"file"` then this makes an open-file dialog.

If type is `"entity"` then this makes a drop-down menu for selecting entities.


### EntityEditor Properties & Methods ###

* `new EntityEditor(editor_config)`

* `EntityEditor.domElement`  
This property contains the HTML content of the entity editor.  
You should insert this DOM element into your user interface.

* `EntityEditor.get_defaults() -> entity`  
Get a new entity object populated with default values.

* `EntityEditor.get_data() -> entity`  
Get a new entity object populated with the currently displayed data.

* `EntityEditor.set_data(entity)`  
Set the form's input values using the given entity object.  
Missing fields are filled in with their default value. If the argument is
missing then this resets the entire form to its default state.

* `EntityEditor.enable()` and `EntityEditor.disable()`  
Enable and disable the entire form. By default the form is enabled.


## EntityManager ##

The entity manager allows the user to control a list of entities. The user may
add, remove, select, duplicate, or reorder entities. The user must give each
entity a globally unique name. EntityManager panels are automatically paired
with an EntityEditor panel, which allows the user to select and interact with
specific entities.

The `EntityManager` class constructor accepts an object with the following fields:

* `"name"`  
Required, this will be the name of the entity list in the resulting data object.  
EntityEditor and EntityManager names must be globally unique.

* `"title"`  
Optional flavor text.

* `"description"`  
Optional flavor text.

* `"keep_sorted"`  
If `true` then this keeps the entities sorted by their "name" property.  
If it's a function then it's used to compare entity objects to keep them sorted.  
Optional, default: `false`

* `"entities"`  
Required, a list of `EntityEditor` specifications for the entity types to be managed by this class.


### EntityManager Properties & Methods ###

* `new EntityManager(manager_config)`  

* `EntityManager.domElement`  
This property contains the HTML content of the entity manager.  
You should insert this DOM element into your user interface.

* `EntityManager.get_selected() -> entity or undefined`  
Returns the currently selected entity, or undefined if nothing is selected.

* `EntityManager.get_selected_index() -> Number or undefined`  
Returns the index of the currently selected entity, or undefined if nothing is selected.

* `EntityManager.select_index(index)`  
Select an entity by its index in the entity list.

* `EntityManager.select_name(name)`  
Select the named entity.

* `EntityManager.get_data() -> entity_list`  
Returns a copy of the entire entity list, including any modifications currently
being made by the editor.    

* `EntityManager.set_data(entity_list)`  
Set the entity list to the given list of entity objects.  
This discards all previously existing data from the entity manager.

* `EntityManager.get_entity_editor(entity_type) -> EntityEditor or undefined`  
Returns the `EntityEditor` object with the given name, or undefined if it's not
found within this manager.


### Callback Hooks ###

The EntityManager class provides callback hooks for certain events. These are
lists of callable functions that you may append to.

You may disregard the callback arguments and simply access the entities in
question using the `get_selected()` and `get_selected_index()` methods.

| Hook Name        | Trigger Event | Callback Arguments |
| ---------        | ------------- | ------------------ |
| `select_hooks`   | An entity from the list was selected | The selected entity object |
| `deselect_hooks` | An entity from the list stopped being selected | The deselected entity object |
| `set_data_hooks` | The entity manager received an entirely new entity list, via one of the `set_data()` functions | The new list of entity objects |
| `create_hooks`   | A new entity was created | The new entity object |
| `change_hooks`   | An entity was edited by the user | The updated entity object |
| `delete_hooks`   | An entity was deleted | The deleted entity object |
| `rename_hooks`   | An entity was renamed | The old and new names of the entity in that order |
| `move_hooks`     | Two entities were reordered by the "Move Up" or "Move Down" buttons | The indices of the two entities which were swapped |


## Examples ##

* [Simple Example](/example.html),  
  [Rendered Results](/example.avif)

* [Morphology Wizard](https://github.com/ctrl-z-9000-times/morphology_wizard)

