import './stimulus_bootstrap.js';
import Alpine from 'alpinejs';
import './scripts/app/index.js';

/*
 * Main JavaScript file of the Twig pages, included via the importmap() Twig function in base.html.twig.
 */
import './styles/app.css';
import './styles/app-layout.css';
import './styles/app-components.css';

/* init */
Alpine.start();
