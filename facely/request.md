WHAT ARE WE DOING:
we are about to add the program generation feature in the app...
it'll be powered by app's own logics. 
There are 15 different exercises provided in the "aligned_exercises" with their pose images and performing details. 
program will be of 70 days..
the details for the placement of the exercises are mentioned in the program.md file... ( which exercises to prioritize under what specific scored faces and the progressive over loading details)

YOUR JOB:

adding a new screen in the app named program...

it takes raw scores of the user's face and create the program.

by creating the program, i meant it'll use app's logic that you'll define ( logic will be defined by the rules i stated in the program.md) 

each day will have 5 exercises.

main screen will be like containing 70 separate components over which day's name is mentioned listed from upside down each row containing 5 days.

when user will click a day, it'll be shifted to a screen named tasks ( you'll also create this screen), containing the tasks of that specific day ( by tasks i meant exercises, those exercises our app has selected for the user for that specific day) , 5 exercises will be shown as per day's activity on that screen, when the user will click a particular exercise from the list, a component will pop up asking 2 questions "task completed?" or "start"... if the user presses task completed, the exercise for which it clicked it will checked off, like a tick will be shown against the exercise in the list of exercise for that specific day's task screen...but if he presses the start, a new component will pop up, including 4 things... the protocol to do the exercise, the exercise name as the header, the 30 s timer, and the animation of the exercise.  basically the animation is just switching images from initial pose to end pose, like a loop of them until the timer ends... like one sec initial pose and one second final pose... for any particular exercise, if there are like 3 poses, each pose will be shown off for 1 sec in a loop...