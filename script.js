'use strict';

class Workout {
  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min

    this.date = new Date();
    this.id = (Date.now() + '').slice(-10);
    this.clicks = 0;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();

    this.type = 'running';
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();

    this.type = 'cycling';
    this._setDescription();
  }

  calcSpeed() {
    // min/km
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE

const deleteAll = document.querySelector('.workout__delete-all');
const sort = document.querySelector('.workout__sort');
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const messageElem = document.querySelector('.message');

class App {
  // _map;
  // _mapZoomLevel = 13;
  // _mapEvent;
  // _workouts = [];
  // _editing = false;
  // _messageIds = [];

  constructor() {
    this._map;
    this._mapZoomLevel = 13;
    this._mapEvent;
    this._workouts = [];
    this._editing = false;
    this._messageIds = [];

    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getlocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener(
      'click',
      this._addContainerWorkoutsEvents.bind(this)
    );
    // delegate later
    deleteAll.addEventListener('click', this._deleteAllWorkouts.bind(this));
    sort.addEventListener('click', this._sortWorkouts.bind(this));
  }

  static _validInputs = (...inputs) =>
    inputs.every(inp => Number.isFinite(inp));
  static _allPositive = (...inputs) => inputs.every(inp => inp > 0);

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          this._messageIds = this._showMessage(
            'Could not get your position',
            'error'
          );
        }.bind(this)
      );
    }
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    this._map = L.map('map').setView(coords, this._mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this._map);

    // Handling clicks on map
    this._map.on('click', this._showForm.bind(this));

    // render markers
    this._workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
  }

  _showForm(mapE) {
    if (this._isEditing()) return;

    this._mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(function () {
      form.style.display = 'grid';
    }, 1000);
  }

  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this._mapEvent.latlng;
    let workout;

    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !App._validInputs(distance, duration, cadence) ||
        !App._allPositive(distance, duration, cadence)
      )
        return (this._messageIds = this._showMessage(
          'Inputs have to be positive numbers',
          'error'
        ));

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !App._validInputs(distance, duration, elevation) ||
        !App._allPositive(distance, duration)
      )
        return (this._messageIds = this._showMessage(
          'Inputs have to be positive numbers',
          'error'
        ));

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this._workouts.push(workout);

    this._renderWorkoutMarker(workout);

    this._renderWorkout(workout);

    this._hideForm();

    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this._map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__options">
          <span class="workout__edit workout__btn">📝</span>
          <span class="workout__confirm workout__btn">✅</span>
          <span class="workout__cancel workout__btn">❌</span>
          <span class="workout__delete workout__btn">🗑️</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value--distance">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value--duration">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value--pace">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value--cadence">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
    `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value--speed">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value--elevationGain">${
            workout.elevationGain
          }</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
    `;

    // containerWorkouts.insertAdjacentHTML('beforeend', html);
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutElem = e.target.closest('.workout');

    if (!workoutElem) return;

    const workout = this._workouts.find(
      work => work.id === workoutElem.dataset.id
    );

    this._map.setView(workout.coords, this._mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
    // using the public interface
    workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this._workouts));
  }

  _getlocalStorage() {
    const data = localStorage.getItem('workouts');

    if (!data) return;

    this._workouts = JSON.parse(data);

    // Restore the objects' prototype chain back
    this._workouts = this._workouts.map(workout => {
      if (workout.type === 'running') workout.__proto__ = Running.prototype;
      if (workout.type === 'cycling') workout.__proto__ = Cycling.prototype;
      return workout;
    });

    this._workouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  _isEditing() {
    if (this._editing)
      this._messageIds = this._showMessage('Editing in progress...', 'error');
    return this._editing;
  }

  _startEdit(e) {
    if (!e.target.classList.contains('workout__edit')) return;

    // check if any edit in progress
    if (this._isEditing()) return;

    // tell app you're editing
    this._editing = true;

    const workoutElem = e.target.closest('.workout');
    workoutElem.classList.add('edit');

    // add edit form
    let html = `
      <form class="edit__form">
        <div class="form__row">
          <label class="form__label">Distance</label>
          <input
            class="form__input edit__input--distance"
            placeholder="km"
          />
        </div>
        <div class="form__row">
          <label class="form__label">Duration</label>
          <input
            class="form__input edit__input--duration"
            placeholder="min"
          />
        </div>
    `;

    if (workoutElem.classList.contains('workout--running'))
      html += `
        <div class="form__row">
          <label class="form__label">Cadence</label>
          <input
            class="form__input edit__input--cadence"
            placeholder="step/min"
          />
        </div>
      </form>
    `;

    if (workoutElem.classList.contains('workout--cycling'))
      html += `
        <div class="form__row">
          <label class="form__label">Elev Gain</label>
          <input
            class="form__input edit__input--elevation"
            placeholder="meters"
          />
        </div>
      </form>
    `;

    workoutElem.insertAdjacentHTML('beforeend', html);
    workoutElem.querySelector('.edit__input--distance').focus();

    /////////////////////////////////////////////////////////////////////
    // Still under consideration
    document.querySelector('.edit__form').style.height = '0';
    document.querySelector('.edit__form').style.overflow = 'hidden';
    document.querySelector('.edit__form').style.transition = 'all 0.15s';
    setTimeout(() => {
      document.querySelector('.edit__form').style.height = '55.5px';
    }, 150);
    /////////////////////////////////////////////////////////////////////
  }

  _endEdit(workoutElem) {
    // tell app you're finished editing
    this._editing = false;

    workoutElem.classList.remove('edit');

    workoutElem.querySelector('.edit__form').remove();
  }

  _validateEdit(workoutElem, workout, distance, duration, cadORelev) {
    if (
      !App._validInputs(distance, duration, cadORelev) ||
      !App._allPositive(distance, duration, cadORelev)
    )
      return (this._messageIds = this._showMessage(
        'Inputs have to be positive numbers',
        'error'
      ));

    workout[`${workout.type === 'running' ? 'calcPace' : 'calcSpeed'}`]();
    this._saveEditedWorkout(workout, distance, duration, cadORelev);
    this._renderEditedWorkout(workoutElem, workout); // not 'this._renderWorkout' coz of performance 😅
    this._endEdit(workoutElem);
    this._messageIds = this._showMessage('Successfully Edited', 'success');
  }

  _confirmEdit(e) {
    if (!e.target.classList.contains('workout__confirm')) return;

    const workoutElem = e.target.closest('.workout');

    // get workout object
    const workout = this._workouts.find(
      work => work.id === workoutElem.dataset.id
    );

    const distance = +workoutElem.querySelector('.edit__input--distance').value;
    const duration = +workoutElem.querySelector('.edit__input--duration').value;

    // validate inputs
    if (workoutElem.classList.contains('workout--running')) {
      const cadence = +workoutElem.querySelector('.edit__input--cadence').value;

      this._validateEdit(workoutElem, workout, distance, duration, cadence);
    }

    if (workoutElem.classList.contains('workout--cycling')) {
      const elevation = +workoutElem.querySelector('.edit__input--elevation')
        .value;
      this._validateEdit(workoutElem, workout, distance, duration, elevation);
    }
  }

  // might be redundant, see after completion
  _cancelEdit(e) {
    if (!e.target.classList.contains('workout__cancel')) return;

    const workoutElem = e.target.closest('.workout');

    this._endEdit(workoutElem);
  }

  _saveEditedWorkout(workout, distance, duration, cadORelev) {
    workout.distance = distance;
    workout.duration = duration;
    workout[`${workout.type === 'running' ? 'cadence' : 'elevationGain'}`] =
      cadORelev;
    workout[`${workout.type === 'running' ? 'calcPace' : 'calcSpeed'}`]();

    this._setLocalStorage();
  }

  _renderEditedWorkout(workoutElem, workout) {
    workoutElem.querySelector('.workout__value--distance').innerHTML =
      workout.distance;
    workoutElem.querySelector('.workout__value--duration').innerHTML =
      workout.duration;

    if (workout.type === 'running') {
      workoutElem.querySelector('.workout__value--pace').innerHTML =
        workout.pace.toFixed(1);
      workoutElem.querySelector('.workout__value--cadence').innerHTML =
        workout.cadence;
    }

    if (workout.type === 'cycling') {
      workoutElem.querySelector('.workout__value--speed').innerHTML =
        workout.speed.toFixed(1);
      workoutElem.querySelector('.workout__value--elevationGain').innerHTML =
        workout.elevationGain;
    }
  }
  ////////////////////////////////////////////////////////////////////////
  _eraseWorkout(workoutElem) {
    const removeMarker = function (layer) {
      if (!(layer instanceof L.Marker)) return;

      const { lat, lng } = layer.getLatLng();
      if (
        this._workouts[workoutIndex].coords[0] === lat &&
        this._workouts[workoutIndex].coords[1] === lng
      )
        layer.remove();
    };

    const workoutIndex = this._workouts.findIndex(
      workout => workout.id === workoutElem.dataset.id
    );

    // remove marker from map
    this._map.eachLayer(removeMarker.bind(this));

    // delete obj from workouts array
    this._workouts.splice(workoutIndex, 1);

    // remove workoutElem from User Interface
    workoutElem.remove();

    // save to local storage
    this._setLocalStorage();
  }

  _deteleWorkout(e) {
    if (!e.target.classList.contains('workout__delete')) return;

    const workoutElem = e.target.closest('.workout');
    this._eraseWorkout(workoutElem);
  }

  _deleteAllWorkouts() {
    if (!confirm('Are you sure you want to delete all workouts?')) return;

    document.querySelectorAll('.workout').forEach(el => {
      this._eraseWorkout(el);
    });
  }

  _sortWorkouts() {
    const sortBy = document.querySelector('.sort__input--type').value;
    if (sortBy === '')
      return (this._messageIds = this._showMessage(
        'Pick a valid sorting option',
        'error'
      ));

    const sort = sortBy => {
      const sortedWorkouts = this._workouts
        .map(workout => workout)
        .sort((a, b) => b[`${sortBy}`] - a[`${sortBy}`]);

      document.querySelectorAll('.workout').forEach((el, i) => {
        el.remove();
        this._renderWorkout(sortedWorkouts[i]);
      });
    };

    if (sortBy === 'distance') sort('distance');
    if (sortBy === 'duration') sort('duration');
  }

  _showMessage(message, status) {
    //////////////////////////////
    // fix settimeout id
    // add success message to neccessary places
    //////////////////////////////
    this._messageIds?.forEach(id => clearTimeout(id));

    messageElem.innerText = message;
    messageElem.classList.add(status, 'message--show');

    const id1 = setTimeout(() => {
      messageElem.classList.remove('message--show');
    }, 4000); // 4000

    const id2 = setTimeout(() => {
      messageElem.classList.remove(status);
      messageElem.innerText = '';
    }, 4500); // 4000 + 500(transition time)
    return [id1, id2];
  }
  ////////////////////////////////////////////////////////////////////////
  _addContainerWorkoutsEvents(e) {
    this._moveToPopup(e);
    this._startEdit(e);
    this._confirmEdit(e);
    this._cancelEdit(e);
    this._deteleWorkout(e);
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
