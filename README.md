# BioNutriScan

BioNutriScan is a web application that helps users identify potential vitamin deficiencies by analyzing facial features. The application uses a machine learning model to detect facial landmarks and predict possible deficiencies. Users can also provide feedback on the predictions, which can be reviewed by an administrator.

## Project Structure

The project is divided into two main parts: a frontend and a backend.

- `frontend/`: Contains the React-based user interface.
- `backend/`: Contains the Flask-based server that handles the machine learning model and other backend logic.
- `training_code.ipynb`: Jupyter notebook with the training code for the model.

## Installation

### Backend

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv .venv
    ```
3.  Activate the virtual environment:
    -   On Windows:
        ```bash
        .venv\\Scripts\\activate
        ```
    -   On macOS/Linux:
        ```bash
        source .venv/bin/activate
        ```
4.  Install the required Python packages:
    ```bash
    pip install -r requirements.txt
    ```
5.  Create a `.env` file in the `backend` directory and add the following environment variables:
    ```
    GEMINI_API_KEY=your_gemini_api_key
    GEMINI_MODEL=gemini-2.5-pro
    ```

### Frontend

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install the required npm packages:
    ```bash
    npm install
    ```
3.  Create a `firebase.ts` file in `frontend/src` and add the following configuration:
    ```typescript
    // Import the functions you need from the SDKs you need
    import { initializeApp } from "firebase/app";
    import { getDatabase } from "firebase/database";
    import { getStorage } from "firebase/storage";

    // Your web app's Firebase configuration
    const firebaseConfig = {
      apiKey: "your_api_key",
      authDomain: "your_auth_domain",
      databaseURL: "your_database_url",
      projectId: "your_project_id",
      storageBucket: "your_storage_bucket",
      messagingSenderId: "your_messaging_sender_id",
      appId: "your_app_id",
      measurementId: "your_measurement_id"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    export const db = getDatabase(app);
    export const storage = getStorage(app);
    export default app;
    ```

## Usage

1.  Make sure you are in the `frontend` directory.
2.  Run the following command to start both the backend and frontend servers:
    ```bash
    npm run dev
    ```
3.  Open your browser and navigate to the URL provided by Vite (usually `http://localhost:5173`).

The `backend_url.txt` file in `frontend/public` should contain the URL of the backend server. By default, it is `http://00.00.00.00.:5000`. You may need to change this to your local IP address if you are not running the backend on the same machine or if the IP address is different.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

