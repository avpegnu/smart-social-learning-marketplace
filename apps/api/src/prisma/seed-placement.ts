import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Standalone seed for PlacementQuestion data.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' src/prisma/seed-placement.ts
 */

interface QuestionDef {
  question: string;
  options: { id: string; text: string }[];
  answer: string; // must match one option id
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  tagSlugs: string[]; // will be resolved to tag IDs
}

// ── Web Development Questions ──

const webQuestions: QuestionDef[] = [
  // BEGINNER
  {
    question: 'What does HTML stand for?',
    options: [
      { id: 'a', text: 'HyperText Markup Language' },
      { id: 'b', text: 'High Technology Modern Language' },
      { id: 'c', text: 'HyperTransfer Markup Language' },
      { id: 'd', text: 'Home Tool Markup Language' },
    ],
    answer: 'a',
    level: 'BEGINNER',
    tagSlugs: ['html', 'css'],
  },
  {
    question: 'Which CSS property is used to change the text color of an element?',
    options: [
      { id: 'a', text: 'font-color' },
      { id: 'b', text: 'text-color' },
      { id: 'c', text: 'color' },
      { id: 'd', text: 'foreground-color' },
    ],
    answer: 'c',
    level: 'BEGINNER',
    tagSlugs: ['html', 'css'],
  },
  {
    question: 'What is the correct way to declare a variable in JavaScript (ES6)?',
    options: [
      { id: 'a', text: 'var x = 5;' },
      { id: 'b', text: 'let x = 5;' },
      { id: 'c', text: 'int x = 5;' },
      { id: 'd', text: 'declare x = 5;' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['javascript'],
  },
  {
    question: 'Which tag is used to create a hyperlink in HTML?',
    options: [
      { id: 'a', text: '<link>' },
      { id: 'b', text: '<a>' },
      { id: 'c', text: '<href>' },
      { id: 'd', text: '<url>' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['html'],
  },
  {
    question: 'What does CSS stand for?',
    options: [
      { id: 'a', text: 'Computer Style Sheets' },
      { id: 'b', text: 'Creative Style System' },
      { id: 'c', text: 'Cascading Style Sheets' },
      { id: 'd', text: 'Colorful Style Sheets' },
    ],
    answer: 'c',
    level: 'BEGINNER',
    tagSlugs: ['css'],
  },
  // INTERMEDIATE
  {
    question: 'What is the output of: typeof null in JavaScript?',
    options: [
      { id: 'a', text: '"null"' },
      { id: 'b', text: '"undefined"' },
      { id: 'c', text: '"object"' },
      { id: 'd', text: '"boolean"' },
    ],
    answer: 'c',
    level: 'INTERMEDIATE',
    tagSlugs: ['javascript'],
  },
  {
    question: 'In React, what hook is used to manage side effects?',
    options: [
      { id: 'a', text: 'useMemo' },
      { id: 'b', text: 'useEffect' },
      { id: 'c', text: 'useCallback' },
      { id: 'd', text: 'useReducer' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['react', 'javascript'],
  },
  {
    question: 'What is the purpose of the "key" prop in React lists?',
    options: [
      { id: 'a', text: 'To style list items' },
      { id: 'b', text: 'To help React identify which items changed' },
      { id: 'c', text: 'To set the order of items' },
      { id: 'd', text: 'To encrypt the list data' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['react'],
  },
  {
    question: 'What does the "async" keyword do in JavaScript?',
    options: [
      { id: 'a', text: 'Makes the function run faster' },
      { id: 'b', text: 'Makes the function return a Promise' },
      { id: 'c', text: 'Makes the function run in a separate thread' },
      { id: 'd', text: 'Makes the function synchronous' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['javascript', 'typescript'],
  },
  {
    question: 'Which HTTP method is idempotent?',
    options: [
      { id: 'a', text: 'POST' },
      { id: 'b', text: 'PATCH' },
      { id: 'c', text: 'PUT' },
      { id: 'd', text: 'None of the above' },
    ],
    answer: 'c',
    level: 'INTERMEDIATE',
    tagSlugs: ['rest-api', 'node-js'],
  },
  // ADVANCED
  {
    question: 'What is the time complexity of Array.prototype.includes() in JavaScript?',
    options: [
      { id: 'a', text: 'O(1)' },
      { id: 'b', text: 'O(log n)' },
      { id: 'c', text: 'O(n)' },
      { id: 'd', text: 'O(n²)' },
    ],
    answer: 'c',
    level: 'ADVANCED',
    tagSlugs: ['javascript'],
  },
  {
    question: 'In Next.js App Router, what is the purpose of a "loading.tsx" file?',
    options: [
      { id: 'a', text: 'Shows a loading indicator while CSS loads' },
      { id: 'b', text: 'Creates a Suspense boundary for the route segment' },
      { id: 'c', text: 'Loads external scripts' },
      { id: 'd', text: 'Preloads images for the page' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['next-js', 'react'],
  },
  {
    question: 'What is "tree shaking" in modern JavaScript bundlers?',
    options: [
      { id: 'a', text: 'A way to organize folder structure' },
      { id: 'b', text: 'Dead code elimination based on ES module imports' },
      { id: 'c', text: 'A caching strategy for modules' },
      { id: 'd', text: 'A technique to split code into chunks' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['javascript', 'typescript'],
  },
  {
    question: 'What problem does React Server Components solve?',
    options: [
      { id: 'a', text: 'Reduces client-side JavaScript bundle size' },
      { id: 'b', text: 'Replaces CSS-in-JS libraries' },
      { id: 'c', text: 'Eliminates the need for state management' },
      { id: 'd', text: 'Removes the need for API routes' },
    ],
    answer: 'a',
    level: 'ADVANCED',
    tagSlugs: ['react', 'next-js'],
  },
  {
    question: 'In NestJS, what is the purpose of Dependency Injection?',
    options: [
      { id: 'a', text: 'To inject CSS styles into components' },
      { id: 'b', text: 'To manage class dependencies through IoC container' },
      { id: 'c', text: 'To inject environment variables' },
      { id: 'd', text: 'To add middleware to routes' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['nestjs', 'node-js', 'typescript'],
  },
];

// ── Data Science Questions ──

const dataQuestions: QuestionDef[] = [
  // BEGINNER
  {
    question: 'Which Python keyword is used to define a function?',
    options: [
      { id: 'a', text: 'function' },
      { id: 'b', text: 'func' },
      { id: 'c', text: 'def' },
      { id: 'd', text: 'define' },
    ],
    answer: 'c',
    level: 'BEGINNER',
    tagSlugs: ['python'],
  },
  {
    question: 'What is a DataFrame in Pandas?',
    options: [
      { id: 'a', text: 'A type of chart' },
      { id: 'b', text: 'A 2D labeled data structure' },
      { id: 'c', text: 'A database connection' },
      { id: 'd', text: 'A file format' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['python'],
  },
  {
    question: 'What does SQL stand for?',
    options: [
      { id: 'a', text: 'Simple Question Language' },
      { id: 'b', text: 'Structured Query Language' },
      { id: 'c', text: 'Standard Query Logic' },
      { id: 'd', text: 'Sequential Query Language' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['sql'],
  },
  {
    question: 'Which Python library is commonly used for numerical computing?',
    options: [
      { id: 'a', text: 'Django' },
      { id: 'b', text: 'Flask' },
      { id: 'c', text: 'NumPy' },
      { id: 'd', text: 'Requests' },
    ],
    answer: 'c',
    level: 'BEGINNER',
    tagSlugs: ['python'],
  },
  {
    question: 'What is the purpose of data visualization?',
    options: [
      { id: 'a', text: 'To make data look pretty' },
      { id: 'b', text: 'To communicate insights and patterns in data' },
      { id: 'c', text: 'To compress data' },
      { id: 'd', text: 'To encrypt sensitive information' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['python'],
  },
  // INTERMEDIATE
  {
    question: 'What is overfitting in machine learning?',
    options: [
      { id: 'a', text: 'Model performs well on all data' },
      { id: 'b', text: 'Model learns noise in training data and performs poorly on new data' },
      { id: 'c', text: 'Model is too simple to capture patterns' },
      { id: 'd', text: 'Model takes too long to train' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['machine-learning', 'python'],
  },
  {
    question: 'Which SQL clause is used to filter grouped results?',
    options: [
      { id: 'a', text: 'WHERE' },
      { id: 'b', text: 'FILTER' },
      { id: 'c', text: 'HAVING' },
      { id: 'd', text: 'GROUP BY' },
    ],
    answer: 'c',
    level: 'INTERMEDIATE',
    tagSlugs: ['sql', 'postgresql'],
  },
  {
    question: 'What is the difference between supervised and unsupervised learning?',
    options: [
      { id: 'a', text: 'Supervised uses more data' },
      { id: 'b', text: 'Supervised uses labeled data, unsupervised finds patterns without labels' },
      { id: 'c', text: 'Unsupervised is always more accurate' },
      { id: 'd', text: 'There is no difference' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['machine-learning'],
  },
  {
    question: 'What is cross-validation used for?',
    options: [
      { id: 'a', text: 'To validate user input' },
      { id: 'b', text: 'To evaluate model performance on unseen data' },
      { id: 'c', text: 'To speed up training' },
      { id: 'd', text: 'To clean the dataset' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['machine-learning', 'python'],
  },
  {
    question: 'What is a JOIN operation in SQL?',
    options: [
      { id: 'a', text: 'Combining rows from two or more tables based on a related column' },
      { id: 'b', text: 'Merging two databases into one' },
      { id: 'c', text: 'Connecting to a remote server' },
      { id: 'd', text: 'Appending rows to a table' },
    ],
    answer: 'a',
    level: 'INTERMEDIATE',
    tagSlugs: ['sql', 'postgresql'],
  },
  // ADVANCED
  {
    question: 'What is the vanishing gradient problem in deep learning?',
    options: [
      { id: 'a', text: 'Gradients become zero when the model converges' },
      { id: 'b', text: 'Gradients become too small during backpropagation in deep networks' },
      { id: 'c', text: 'The loss function disappears during training' },
      { id: 'd', text: 'The learning rate is set too high' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['deep-learning', 'python'],
  },
  {
    question: 'What is the purpose of attention mechanism in Transformers?',
    options: [
      { id: 'a', text: 'To reduce training time' },
      { id: 'b', text: 'To allow the model to focus on relevant parts of the input' },
      { id: 'c', text: 'To compress the model size' },
      { id: 'd', text: 'To normalize the output' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['deep-learning', 'nlp'],
  },
  {
    question: 'What is the bias-variance tradeoff?',
    options: [
      { id: 'a', text: 'Choosing between speed and accuracy' },
      {
        id: 'b',
        text: 'Balancing model simplicity (bias) against sensitivity to training data (variance)',
      },
      { id: 'c', text: 'Deciding between more data or more features' },
      { id: 'd', text: 'Trading off training time for model size' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['machine-learning'],
  },
  {
    question: 'What is a Convolutional Neural Network (CNN) primarily used for?',
    options: [
      { id: 'a', text: 'Time series forecasting' },
      { id: 'b', text: 'Image and spatial data processing' },
      { id: 'c', text: 'Text generation' },
      { id: 'd', text: 'Tabular data classification' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['deep-learning', 'computer-vision'],
  },
  {
    question: 'What is transfer learning?',
    options: [
      { id: 'a', text: 'Moving data between databases' },
      { id: 'b', text: 'Using a pre-trained model as starting point for a new task' },
      { id: 'c', text: 'Transferring code between programming languages' },
      { id: 'd', text: 'Copying model weights to another server' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['deep-learning', 'machine-learning'],
  },
];

// ── Mobile Development Questions ──

const mobileQuestions: QuestionDef[] = [
  // BEGINNER
  {
    question: 'What is Flutter?',
    options: [
      { id: 'a', text: 'A programming language' },
      { id: 'b', text: 'A cross-platform UI toolkit by Google' },
      { id: 'c', text: 'A database engine' },
      { id: 'd', text: 'A web browser' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['flutter'],
  },
  {
    question: 'What programming language does Flutter use?',
    options: [
      { id: 'a', text: 'Java' },
      { id: 'b', text: 'Swift' },
      { id: 'c', text: 'Dart' },
      { id: 'd', text: 'Kotlin' },
    ],
    answer: 'c',
    level: 'BEGINNER',
    tagSlugs: ['flutter'],
  },
  {
    question: 'What is React Native?',
    options: [
      { id: 'a', text: 'A native iOS framework' },
      { id: 'b', text: 'A framework for building mobile apps using React and JavaScript' },
      { id: 'c', text: 'A CSS library' },
      { id: 'd', text: 'A database for mobile apps' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['react-native', 'javascript'],
  },
  {
    question: 'What is the main advantage of cross-platform mobile development?',
    options: [
      { id: 'a', text: 'Better performance than native' },
      { id: 'b', text: 'Single codebase for multiple platforms' },
      { id: 'c', text: 'Access to more device features' },
      { id: 'd', text: 'Smaller app size' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['flutter', 'react-native'],
  },
  {
    question: 'Which company developed Kotlin?',
    options: [
      { id: 'a', text: 'Google' },
      { id: 'b', text: 'Apple' },
      { id: 'c', text: 'JetBrains' },
      { id: 'd', text: 'Microsoft' },
    ],
    answer: 'c',
    level: 'BEGINNER',
    tagSlugs: ['kotlin'],
  },
  // INTERMEDIATE
  {
    question: 'In Flutter, what is the difference between StatelessWidget and StatefulWidget?',
    options: [
      { id: 'a', text: 'StatelessWidget is faster' },
      { id: 'b', text: 'StatefulWidget can maintain mutable state that changes over time' },
      { id: 'c', text: 'StatelessWidget cannot have children' },
      { id: 'd', text: 'They are the same thing' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['flutter'],
  },
  {
    question: 'What is the purpose of the "bridge" in React Native?',
    options: [
      { id: 'a', text: 'To connect two React components' },
      { id: 'b', text: 'To communicate between JavaScript and native code' },
      { id: 'c', text: 'To bridge the gap between design and code' },
      { id: 'd', text: 'To connect to remote APIs' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['react-native'],
  },
  {
    question: 'What state management solution is commonly used with Flutter?',
    options: [
      { id: 'a', text: 'Redux' },
      { id: 'b', text: 'MobX' },
      { id: 'c', text: 'Provider / Riverpod' },
      { id: 'd', text: 'Vuex' },
    ],
    answer: 'c',
    level: 'INTERMEDIATE',
    tagSlugs: ['flutter'],
  },
  {
    question: 'In Swift, what is an Optional?',
    options: [
      { id: 'a', text: 'A type that can hold a value or nil' },
      { id: 'b', text: 'A function parameter that is not required' },
      { id: 'c', text: 'A UI component' },
      { id: 'd', text: 'A testing framework' },
    ],
    answer: 'a',
    level: 'INTERMEDIATE',
    tagSlugs: ['swift'],
  },
  {
    question: 'What is Expo in the React Native ecosystem?',
    options: [
      { id: 'a', text: 'A state management library' },
      { id: 'b', text: 'A set of tools and services for building React Native apps' },
      { id: 'c', text: 'A testing framework' },
      { id: 'd', text: 'A CSS framework for mobile' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['react-native', 'javascript'],
  },
  // ADVANCED
  {
    question: 'What is the Flutter rendering pipeline order?',
    options: [
      { id: 'a', text: 'Build → Layout → Paint → Composite' },
      { id: 'b', text: 'Layout → Build → Composite → Paint' },
      { id: 'c', text: 'Paint → Layout → Build → Composite' },
      { id: 'd', text: 'Composite → Build → Layout → Paint' },
    ],
    answer: 'a',
    level: 'ADVANCED',
    tagSlugs: ['flutter'],
  },
  {
    question: 'What is the new architecture in React Native (Fabric)?',
    options: [
      { id: 'a', text: 'A new JavaScript engine' },
      {
        id: 'b',
        text: 'A new rendering system that enables synchronous communication with native',
      },
      { id: 'c', text: 'A new build tool' },
      { id: 'd', text: 'A new navigation library' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['react-native'],
  },
  {
    question: 'What is method swizzling in iOS development?',
    options: [
      { id: 'a', text: 'A way to encrypt methods' },
      { id: 'b', text: 'Exchanging the implementation of two methods at runtime' },
      { id: 'c', text: 'A code obfuscation technique' },
      { id: 'd', text: 'A performance optimization' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['swift'],
  },
  {
    question: 'What is Kotlin Coroutines used for?',
    options: [
      { id: 'a', text: 'UI rendering' },
      { id: 'b', text: 'Asynchronous programming and structured concurrency' },
      { id: 'c', text: 'Database queries' },
      { id: 'd', text: 'Animation' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['kotlin'],
  },
  {
    question: 'What is platform channel in Flutter?',
    options: [
      { id: 'a', text: 'A way to distribute apps to different stores' },
      {
        id: 'b',
        text: 'A mechanism for communicating between Dart and platform-specific native code',
      },
      { id: 'c', text: 'A CI/CD pipeline' },
      { id: 'd', text: 'A notification system' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['flutter'],
  },
];

// ── DevOps & Cloud Questions ──

const devopsQuestions: QuestionDef[] = [
  // BEGINNER
  {
    question: 'What is Docker?',
    options: [
      { id: 'a', text: 'A programming language' },
      { id: 'b', text: 'A platform for building and running containerized applications' },
      { id: 'c', text: 'A cloud provider' },
      { id: 'd', text: 'A version control system' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['docker'],
  },
  {
    question: 'What is the difference between a container and a virtual machine?',
    options: [
      { id: 'a', text: 'No difference' },
      { id: 'b', text: 'Containers share the host OS kernel, VMs have their own OS' },
      { id: 'c', text: 'VMs are always faster than containers' },
      { id: 'd', text: 'Containers require more resources' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['docker'],
  },
  {
    question: 'What is Git used for?',
    options: [
      { id: 'a', text: 'Deploying applications' },
      { id: 'b', text: 'Version control and source code management' },
      { id: 'c', text: 'Database management' },
      { id: 'd', text: 'Server monitoring' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['git'],
  },
  {
    question: 'What is CI/CD?',
    options: [
      { id: 'a', text: 'A programming paradigm' },
      { id: 'b', text: 'Continuous Integration / Continuous Delivery' },
      { id: 'c', text: 'A cloud storage service' },
      { id: 'd', text: 'A database type' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['ci-cd', 'git'],
  },
  {
    question: 'What is Linux primarily known as?',
    options: [
      { id: 'a', text: 'A web browser' },
      { id: 'b', text: 'An open-source operating system kernel' },
      { id: 'c', text: 'A programming language' },
      { id: 'd', text: 'A cloud platform' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['linux'],
  },
  // INTERMEDIATE
  {
    question: 'What is a Dockerfile used for?',
    options: [
      { id: 'a', text: 'To document the project' },
      { id: 'b', text: 'To define instructions for building a Docker image' },
      { id: 'c', text: 'To configure network settings' },
      { id: 'd', text: 'To manage container logs' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['docker'],
  },
  {
    question: 'What is Docker Compose used for?',
    options: [
      { id: 'a', text: 'Writing music' },
      { id: 'b', text: 'Defining and running multi-container Docker applications' },
      { id: 'c', text: 'Composing email templates' },
      { id: 'd', text: 'Managing single containers' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['docker'],
  },
  {
    question: 'What is an AWS EC2 instance?',
    options: [
      { id: 'a', text: 'A database service' },
      { id: 'b', text: 'A virtual server in the cloud' },
      { id: 'c', text: 'A CDN service' },
      { id: 'd', text: 'A monitoring tool' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['aws'],
  },
  {
    question: 'What is the purpose of a reverse proxy like Nginx?',
    options: [
      { id: 'a', text: 'To reverse engineer applications' },
      { id: 'b', text: 'To distribute incoming requests to backend servers' },
      { id: 'c', text: 'To encrypt files' },
      { id: 'd', text: 'To compress images' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['linux', 'docker'],
  },
  {
    question: 'What does the "git rebase" command do?',
    options: [
      { id: 'a', text: 'Deletes a branch' },
      { id: 'b', text: 'Reapplies commits on top of another base' },
      { id: 'c', text: 'Creates a new repository' },
      { id: 'd', text: 'Reverts all changes' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['git'],
  },
  // ADVANCED
  {
    question: 'What is a Kubernetes Pod?',
    options: [
      { id: 'a', text: 'A virtual machine' },
      { id: 'b', text: 'The smallest deployable unit, containing one or more containers' },
      { id: 'c', text: 'A storage volume' },
      { id: 'd', text: 'A network interface' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['kubernetes', 'docker'],
  },
  {
    question: 'What is a Helm chart in Kubernetes?',
    options: [
      { id: 'a', text: 'A monitoring dashboard' },
      { id: 'b', text: 'A package of pre-configured Kubernetes resources' },
      { id: 'c', text: 'A networking configuration' },
      { id: 'd', text: 'A logging framework' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['kubernetes'],
  },
  {
    question: 'What is Infrastructure as Code (IaC)?',
    options: [
      { id: 'a', text: 'Writing application code on servers' },
      { id: 'b', text: 'Managing infrastructure through machine-readable definition files' },
      { id: 'c', text: 'Coding directly on production servers' },
      { id: 'd', text: 'A programming language for servers' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['aws', 'ci-cd'],
  },
  {
    question: 'What is a Service Mesh (e.g., Istio)?',
    options: [
      { id: 'a', text: 'A type of network cable' },
      { id: 'b', text: 'A dedicated infrastructure layer for service-to-service communication' },
      { id: 'c', text: 'A mesh network for WiFi' },
      { id: 'd', text: 'A frontend framework' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['kubernetes', 'docker'],
  },
  {
    question: 'What is blue-green deployment?',
    options: [
      { id: 'a', text: 'A color-coded logging system' },
      { id: 'b', text: 'Running two production environments and switching traffic between them' },
      { id: 'c', text: 'A testing framework' },
      { id: 'd', text: 'A branch naming convention' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['ci-cd', 'aws', 'kubernetes'],
  },
];

// ── General Programming Questions (no specific category) ──

const generalQuestions: QuestionDef[] = [
  {
    question: 'What is the difference between "==" and "===" in JavaScript?',
    options: [
      { id: 'a', text: 'No difference' },
      { id: 'b', text: '"===" checks value and type, "==" only checks value with type coercion' },
      { id: 'c', text: '"==" is for strings, "===" is for numbers' },
      { id: 'd', text: '"===" is deprecated' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['javascript'],
  },
  {
    question: 'What is TypeScript?',
    options: [
      { id: 'a', text: 'A new programming language unrelated to JavaScript' },
      { id: 'b', text: 'A typed superset of JavaScript that compiles to plain JavaScript' },
      { id: 'c', text: 'A JavaScript testing framework' },
      { id: 'd', text: 'A JavaScript minifier' },
    ],
    answer: 'b',
    level: 'BEGINNER',
    tagSlugs: ['typescript', 'javascript'],
  },
  {
    question: 'What is a REST API?',
    options: [
      { id: 'a', text: 'A database' },
      { id: 'b', text: 'An architectural style for designing networked applications using HTTP' },
      { id: 'c', text: 'A frontend framework' },
      { id: 'd', text: 'A testing tool' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['rest-api', 'node-js'],
  },
  {
    question: 'What is the purpose of an ORM (Object-Relational Mapping)?',
    options: [
      { id: 'a', text: 'To create user interfaces' },
      { id: 'b', text: 'To map database tables to programming language objects' },
      { id: 'c', text: 'To optimize network traffic' },
      { id: 'd', text: 'To manage version control' },
    ],
    answer: 'b',
    level: 'INTERMEDIATE',
    tagSlugs: ['postgresql', 'sql'],
  },
  {
    question: 'What is the CAP theorem in distributed systems?',
    options: [
      { id: 'a', text: 'A theorem about CPU, API, and Performance' },
      {
        id: 'b',
        text: 'A distributed system can only guarantee two of: Consistency, Availability, Partition tolerance',
      },
      { id: 'c', text: 'A security protocol' },
      { id: 'd', text: 'A data compression algorithm' },
    ],
    answer: 'b',
    level: 'ADVANCED',
    tagSlugs: ['postgresql', 'redis'],
  },
];

async function main() {
  console.log('🧪 Seeding placement test questions...\n');

  // Resolve tag slugs → IDs
  const allTags = await prisma.tag.findMany({ select: { id: true, slug: true } });
  const tagMap = new Map(allTags.map((t) => [t.slug, t.id]));

  const allQuestions = [
    ...webQuestions,
    ...dataQuestions,
    ...mobileQuestions,
    ...devopsQuestions,
    ...generalQuestions,
  ];

  let created = 0;
  let skipped = 0;

  for (const q of allQuestions) {
    // Resolve tag slugs to IDs
    const tagIds = q.tagSlugs
      .map((slug) => tagMap.get(slug))
      .filter((id): id is string => id !== undefined);

    if (tagIds.length === 0) {
      console.warn(`⚠ Skipping question (no matching tags): ${q.question.slice(0, 50)}...`);
      skipped++;
      continue;
    }

    // Check if question already exists (avoid duplicates on re-run)
    const existing = await prisma.placementQuestion.findFirst({
      where: { question: q.question },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.placementQuestion.create({
      data: {
        question: q.question,
        options: q.options,
        answer: q.answer,
        level: q.level,
        tagIds,
      },
    });
    created++;
  }

  // Summary
  const counts = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 };
  for (const q of allQuestions) {
    counts[q.level]++;
  }

  console.log(`\n✅ Placement questions seeded!`);
  console.log(`   Created: ${created}, Skipped: ${skipped}`);
  console.log(
    `   By level: BEGINNER=${counts.BEGINNER}, INTERMEDIATE=${counts.INTERMEDIATE}, ADVANCED=${counts.ADVANCED}`,
  );
  console.log(`   Total: ${allQuestions.length} questions across 5 domains`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
